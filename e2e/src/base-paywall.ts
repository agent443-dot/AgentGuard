import { CHAINS, getAddress as sharedAddress, USDC_DECIMALS } from '@agentguard/shared'
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http'
import type { PaymentRequirements } from '@x402/core/types'
import { toFacilitatorEvmSigner } from '@x402/evm'
import { ExactEvmScheme } from '@x402/evm/exact/facilitator'
import { createServer, type ServerResponse } from 'node:http'
import {
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseAbi,
  publicActions,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { z } from 'zod'

// The Base Sepolia counterpart of devnet-paywall.ts: a paid API that is its own facilitator. It
// verifies the EIP-3009 authorization the guard signed and settles it on Base Sepolia, so the Base
// x402 path is proven without trusting a public endpoint. The fee payer needs Base Sepolia ETH.

const address = z.string().refine((value) => isAddress(value), 'not an EVM address')
const env = z
  .object({
    PAYWALL_EVM_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    PAYWALL_BASE_PAY_TO: address,
    // Only until shared/addresses.ts has the verified Base Sepolia USDC (CR-005).
    PAYWALL_BASE_USDC: address.optional().or(z.literal('')),
    PAYWALL_AMOUNT: z
      .string()
      .regex(/^[1-9]\d*$/)
      .default('500000'),
    PAYWALL_BASE_PORT: z.coerce.number().int().positive().default(8791),
    BASE_RPC_URL: z.url().default('https://sepolia.base.org'),
  })
  .safeParse(process.env)
if (!env.success) {
  // Names only: one of these is a private key.
  const fields = new Set(env.error.issues.map((issue) => String(issue.path[0])))
  console.error(`invalid configuration: ${[...fields].join(', ')} (see e2e/.env.example)`)
  process.exit(1)
}
const config = env.data

const network = CHAINS.baseSepolia
const verified = sharedAddress(network, 'usd')
const configured = verified ?? (config.PAYWALL_BASE_USDC || undefined)
if (configured === undefined) {
  console.error('no Base Sepolia USDC: set PAYWALL_BASE_USDC from Circle until CR-005 lands')
  process.exit(1)
}
const usdc: Address = getAddress(configured)

const client = createWalletClient({
  account: privateKeyToAccount(config.PAYWALL_EVM_KEY as Hex),
  chain: baseSepolia,
  transport: http(config.BASE_RPC_URL),
}).extend(publicActions)
const feePayer = client.account.address

// The EIP-712 domain the guard must sign under comes from the token itself, not from a guess.
const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function version() view returns (string)',
])
const read = <F extends 'decimals' | 'name' | 'version'>(functionName: F) =>
  client.readContract({ address: usdc, abi: tokenAbi, functionName })
const [decimals, name, version] = await Promise.all([
  read('decimals'),
  read('name'),
  read('version'),
])
if (decimals !== USDC_DECIMALS) {
  console.error(`token ${usdc} has ${decimals} decimals, not ${USDC_DECIMALS}: not USDC`)
  process.exit(1)
}

// The SDK declares its own shapes for the six calls a facilitator makes; viem's are wider. They are
// the same RPCs, so each is forwarded, and the cast lives only at this seam between the two.
type FacilitatorClient = Parameters<typeof toFacilitatorEvmSigner>[0]
const facilitator = new ExactEvmScheme(
  toFacilitatorEvmSigner({
    address: feePayer,
    readContract: (args) => client.readContract(args as never),
    verifyTypedData: (args) => client.verifyTypedData(args as never),
    writeContract: (args) => client.writeContract(args as never),
    sendTransaction: (args) => client.sendTransaction(args as never),
    waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
    getCode: (args) => client.getCode(args),
  } satisfies FacilitatorClient),
)

const requirements: PaymentRequirements = {
  scheme: 'exact',
  network,
  asset: usdc,
  amount: config.PAYWALL_AMOUNT,
  payTo: getAddress(config.PAYWALL_BASE_PAY_TO),
  maxTimeoutSeconds: 60,
  extra: { name, version },
}

createServer((req, res) => {
  const header = req.headers['payment-signature']
  if (typeof header !== 'string') {
    return ask(res)
  }
  void pay(res, header).catch((error: unknown) => {
    console.error('payment failed:', error instanceof Error ? error.message : 'unknown error')
    ask(res, 'settlement_failed')
  })
}).listen(config.PAYWALL_BASE_PORT, '127.0.0.1', () => {
  console.log(
    `base paywall on http://127.0.0.1:${config.PAYWALL_BASE_PORT}/data, ` +
      `${config.PAYWALL_AMOUNT} atomic USDC (${usdc}, "${name}" v${version}) to ` +
      `${requirements.payTo}, fee payer ${feePayer}`,
  )
})

async function pay(res: ServerResponse, header: string) {
  const payload = decodePaymentSignatureHeader(header)
  const checked = await facilitator.verify(payload, requirements)
  if (!checked.isValid) {
    console.error(`payment refused: ${checked.invalidReason ?? 'invalid'}`)
    return ask(res, checked.invalidReason)
  }
  const settled = await facilitator.settle(payload, requirements)
  if (!settled.success) {
    console.error(`settlement failed: ${settled.errorReason ?? 'unknown'}`)
    return ask(res, settled.errorReason)
  }
  console.log(`settled on Base Sepolia: ${settled.transaction}`)
  res.writeHead(200, {
    'content-type': 'application/json',
    'payment-response': encodePaymentResponseHeader(settled),
  })
  res.end(JSON.stringify({ paid: true, transaction: settled.transaction }))
}

function ask(res: ServerResponse, error?: string) {
  const header = encodePaymentRequiredHeader({
    x402Version: 2,
    ...(error === undefined ? {} : { error }),
    resource: { url: `http://127.0.0.1:${config.PAYWALL_BASE_PORT}/data` },
    accepts: [requirements],
  })
  res.writeHead(402, { 'payment-required': header, 'content-type': 'application/json' })
  res.end('{}')
}
