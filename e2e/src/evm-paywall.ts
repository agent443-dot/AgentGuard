import { CHAINS, getAddress as sharedAddress, USDC_DECIMALS, usdSymbol } from '@agentguard/shared'
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
  encodeAbiParameters,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  publicActions,
  toHex,
  type Address,
  type Chain,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, robinhood, robinhoodTestnet } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { z } from 'zod'

// The EVM counterpart of devnet-paywall.ts: a paid API that is its own facilitator. It verifies the
// EIP-3009 authorization the guard signed and settles it itself, so the x402 path is proven without
// trusting a public endpoint. The fee payer needs the chain's ETH. PAYWALL_EVM_CHAIN picks Base
// Sepolia, Robinhood Chain testnet (CR-007) or Robinhood Chain mainnet for the owner's
// real-money pilot, which pays real USDG to PAYWALL_ROBINHOOD_PAY_TO: the owner's own address.

const address = z.string().refine((value) => isAddress(value), 'not an EVM address')
const amount = z
  .string()
  .regex(/^[1-9]\d*$/)
  .default('500000')
const env = z
  .object({
    PAYWALL_EVM_CHAIN: z.enum([CHAINS.baseSepolia, CHAINS.robinhoodTestnet, CHAINS.robinhood]),
    PAYWALL_EVM_KEY: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional()
      .or(z.literal('')),
    // A file holding the fee payer's key. Required on mainnet, where the key must not sit in .env.
    PAYWALL_EVM_KEY_FILE: z.string().min(1).optional().or(z.literal('')),
    PAYWALL_AMOUNT: amount,
    PAYWALL_BASE_PAY_TO: address.optional().or(z.literal('')),
    PAYWALL_BASE_PORT: z.coerce.number().int().positive().default(8791),
    BASE_RPC_URL: z.url().default('https://sepolia.base.org'),
    PAYWALL_ROBINHOOD_PAY_TO: address.optional().or(z.literal('')),
    PAYWALL_ROBINHOOD_PORT: z.coerce.number().int().positive().default(8792),
    ROBINHOOD_RPC_URL: z.url().optional().or(z.literal('')),
  })
  .safeParse(process.env)
if (!env.success) {
  // Names only: one of these is a private key.
  const fields = new Set(env.error.issues.map((issue) => String(issue.path[0])))
  console.error(`invalid configuration: ${[...fields].join(', ')} (see e2e/.env.example)`)
  process.exit(1)
}
const config = env.data

const network = config.PAYWALL_EVM_CHAIN
const mainnet = network === CHAINS.robinhood
const robinhoodChain = mainnet ? robinhood : robinhoodTestnet
const site: { chain: Chain; payTo: string | undefined; port: number; rpcUrl: string } =
  network !== CHAINS.baseSepolia
    ? {
        chain: robinhoodChain,
        payTo: config.PAYWALL_ROBINHOOD_PAY_TO,
        port: config.PAYWALL_ROBINHOOD_PORT,
        rpcUrl: config.ROBINHOOD_RPC_URL || robinhoodChain.rpcUrls.default.http[0]!,
      }
    : {
        chain: baseSepolia,
        payTo: config.PAYWALL_BASE_PAY_TO,
        port: config.PAYWALL_BASE_PORT,
        rpcUrl: config.BASE_RPC_URL,
      }
if (!site.payTo) {
  console.error(
    `set ${network === CHAINS.baseSepolia ? 'PAYWALL_BASE_PAY_TO' : 'PAYWALL_ROBINHOOD_PAY_TO'}`,
  )
  process.exit(1)
}

const key = feePayerKey()

// The token is the chain's dollar in shared/addresses.ts and nothing else: on Robinhood Chain every
// token named USDC is someone else's (CR-007).
const listed = sharedAddress(network, 'usd')
const symbol = usdSymbol(network)
if (listed === undefined || symbol === undefined) {
  console.error(`shared/addresses.ts has no dollar for ${network}`)
  process.exit(1)
}
const token: Address = getAddress(listed)

const client = createWalletClient({
  account: privateKeyToAccount(key),
  chain: site.chain,
  transport: http(site.rpcUrl),
}).extend(publicActions)
const feePayer = client.account.address

const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
])
const decimals = await client.readContract({
  address: token,
  abi: tokenAbi,
  functionName: 'decimals',
})
if (decimals !== USDC_DECIMALS) {
  console.error(`token ${token} has ${decimals} decimals, not ${USDC_DECIMALS}`)
  process.exit(1)
}
const { name, version } = await tokenDomain()

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
  asset: token,
  amount: config.PAYWALL_AMOUNT,
  payTo: getAddress(site.payTo),
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
}).listen(site.port, '127.0.0.1', () => {
  console.log(
    `${site.chain.name} paywall on http://127.0.0.1:${site.port}/data, ` +
      `${config.PAYWALL_AMOUNT} atomic ${symbol} (${token}, "${name}" v${version}) to ` +
      `${requirements.payTo}, fee payer ${feePayer}`,
  )
})

/** The fee payer's key: from a file on mainnet, where a key in .env is refused, else either. */
function feePayerKey(): Hex {
  if (mainnet && config.PAYWALL_EVM_KEY) {
    console.error('on mainnet the fee payer key comes from PAYWALL_EVM_KEY_FILE, never from .env')
    process.exit(1)
  }
  const raw = config.PAYWALL_EVM_KEY_FILE
    ? readFileSync(config.PAYWALL_EVM_KEY_FILE, 'utf8').trim()
    : config.PAYWALL_EVM_KEY
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    console.error('set PAYWALL_EVM_KEY_FILE (or, off mainnet, PAYWALL_EVM_KEY) to a 0x key')
    process.exit(1)
  }
  return raw as Hex
}

/**
 * The EIP-712 domain the guard must sign under, taken from the token and proven against its own
 * DOMAIN_SEPARATOR. USDC reports its version; USDG has no version() and uses "1", as the chain
 * confirms.
 */
async function tokenDomain(): Promise<{ name: string; version: string }> {
  const name = await client.readContract({ address: token, abi: tokenAbi, functionName: 'name' })
  const version = await client
    .readContract({ address: token, abi: tokenAbi, functionName: 'version' })
    .catch(() => '1')
  const separator = await client.readContract({
    address: token,
    abi: tokenAbi,
    functionName: 'DOMAIN_SEPARATOR',
  })
  const expected = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [
        keccak256(
          toHex(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
          ),
        ),
        keccak256(toHex(name)),
        keccak256(toHex(version)),
        BigInt(site.chain.id),
        token,
      ],
    ),
  )
  if (separator !== expected) {
    console.error(`token ${token}: its DOMAIN_SEPARATOR is not ("${name}", "${version}")`)
    process.exit(1)
  }
  return { name, version }
}

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
  console.log(`settled on ${site.chain.name}: ${settled.transaction}`)
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
    resource: { url: `http://127.0.0.1:${site.port}/data` },
    accepts: [requirements],
  })
  res.writeHead(402, { 'payment-required': header, 'content-type': 'application/json' })
  res.end('{}')
}
