import { CHAINS, requireAddress } from '@agentguard/shared'
import { createKeyPairSignerFromBytes } from '@solana/kit'
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http'
import type { PaymentRequirements } from '@x402/core/types'
import { toFacilitatorSvmSigner } from '@x402/svm'
import { ExactSvmScheme } from '@x402/svm/exact/facilitator'
import { readFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { z } from 'zod'

// A paid API on Solana devnet that is its own facilitator: it verifies the agent's signed payment
// and settles it on the chain, so the x402 path is proven against devnet without trusting a public
// endpoint. Runs on the owner's machine; the fee payer pays the network fee and needs devnet SOL.

const env = z
  .object({
    PAYWALL_FEE_PAYER_KEYPAIR: z.string().min(1),
    PAYWALL_PAY_TO: z.string().min(32).max(44),
    PAYWALL_AMOUNT: z
      .string()
      .regex(/^[1-9]\d*$/)
      .default('500000'),
    PAYWALL_PORT: z.coerce.number().int().positive().default(8790),
    SOLANA_RPC_URL: z.url().default('https://api.devnet.solana.com'),
  })
  .safeParse(process.env)
if (!env.success) {
  const fields = new Set(env.error.issues.map((issue) => String(issue.path[0])))
  console.error(`invalid configuration: ${[...fields].join(', ')} (see e2e/.env.example)`)
  process.exit(1)
}
const config = env.data

const keypair = z.array(z.number().int().min(0).max(255)).length(64)
const bytes = keypair.parse(JSON.parse(readFileSync(config.PAYWALL_FEE_PAYER_KEYPAIR, 'utf8')))
const feePayer = await createKeyPairSignerFromBytes(Uint8Array.from(bytes))
const facilitator = new ExactSvmScheme(
  toFacilitatorSvmSigner(feePayer, { defaultRpcUrl: config.SOLANA_RPC_URL }),
)

const network = CHAINS.solanaDevnet
const requirements: PaymentRequirements = {
  scheme: 'exact',
  network,
  asset: requireAddress(network, 'usdc'),
  amount: config.PAYWALL_AMOUNT,
  payTo: config.PAYWALL_PAY_TO,
  maxTimeoutSeconds: 60,
  extra: facilitator.getExtra(network) ?? {},
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
}).listen(config.PAYWALL_PORT, '127.0.0.1', () => {
  console.log(
    `devnet paywall on http://127.0.0.1:${config.PAYWALL_PORT}/data, ` +
      `${config.PAYWALL_AMOUNT} atomic USDC to ${config.PAYWALL_PAY_TO}, fee payer ${feePayer.address}`,
  )
})

async function pay(res: ServerResponse, header: string) {
  const payload = decodePaymentSignatureHeader(header)
  const verified = await facilitator.verify(payload, requirements)
  if (!verified.isValid) {
    console.error(`payment refused: ${verified.invalidReason ?? 'invalid'}`)
    return ask(res, verified.invalidReason)
  }
  const settled = await facilitator.settle(payload, requirements)
  if (!settled.success) {
    console.error(`settlement failed: ${settled.errorReason ?? 'unknown'}`)
    return ask(res, settled.errorReason)
  }
  console.log(`settled on devnet: ${settled.transaction}`)
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
    resource: { url: `http://127.0.0.1:${config.PAYWALL_PORT}/data` },
    accepts: [requirements],
  })
  res.writeHead(402, { 'payment-required': header, 'content-type': 'application/json' })
  res.end('{}')
}
