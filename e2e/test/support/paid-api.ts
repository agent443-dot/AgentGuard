import { CHAINS, requireAddress } from '@agentguard/shared'
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http'
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/** The chain a suite runs on, and the addresses its payments use there. */
export interface Net {
  chain: string
  token: string
  merchant: string
  attacker: string
  extra: Record<string, unknown>
}

export const SOLANA: Net = {
  chain: CHAINS.solanaDevnet,
  token: requireAddress(CHAINS.solanaDevnet, 'usd'),
  merchant: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  attacker: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
  extra: { feePayer: 'FeePayer1111111111111111111111111111111111' },
}

export const BASE: Net = {
  chain: CHAINS.baseSepolia,
  token: requireAddress(CHAINS.baseSepolia, 'usd'),
  merchant: '0x1111111111111111111111111111111111111111',
  attacker: '0xBAd0000000000000000000000000000000000BAD',
  extra: { name: 'USDC', version: '2' },
}

export const CHAIN = SOLANA.chain
export const MINT = SOLANA.token
export const MERCHANT = SOLANA.merchant
export const ATTACKER = SOLANA.attacker

export function offer(
  overrides: Partial<PaymentRequirements> = {},
  net: Net = SOLANA,
): PaymentRequirements {
  return {
    scheme: 'exact',
    network: net.chain as PaymentRequirements['network'],
    asset: net.token,
    amount: '1000000',
    payTo: net.merchant,
    maxTimeoutSeconds: 60,
    extra: net.extra,
    ...overrides,
  }
}

/**
 * An x402 API on a real port. `quote` is what it asks for; `requote`, when set, is what it asks for
 * instead once a payment arrives, which is how a server moves the terms after the agent agreed.
 */
export interface PaidApi {
  url: string
  quote: PaymentRequirements[]
  requote?: PaymentRequirements[]
  body: string
  payments: PaymentPayload[]
  requests: number
  close(): Promise<void>
}

export async function paidApi(net: Net = SOLANA): Promise<PaidApi> {
  const api: Omit<PaidApi, 'url' | 'close'> = {
    quote: [offer({}, net)],
    body: '{"data":42}',
    payments: [],
    requests: 0,
  }
  const server: Server = createServer((req, res) => {
    api.requests++
    const header = req.headers['payment-signature']
    if (typeof header !== 'string') {
      return ask(res, api.quote)
    }
    api.payments.push(decodePaymentSignatureHeader(header))
    if (api.requote !== undefined) {
      return ask(res, api.requote)
    }
    const settled = encodePaymentResponseHeader({
      success: true,
      transaction: `settled${api.payments.length}`,
      network: net.chain as PaymentRequirements['network'],
    })
    res.writeHead(200, { 'content-type': 'application/json', 'payment-response': settled })
    res.end(api.body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return Object.assign(api, {
    url: `http://127.0.0.1:${port}/data`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  })
}

function ask(res: ServerResponse, accepts: PaymentRequirements[]) {
  const header = encodePaymentRequiredHeader({
    x402Version: 2,
    resource: { url: 'http://127.0.0.1/data' },
    accepts,
  })
  res.writeHead(402, { 'payment-required': header, 'content-type': 'application/json' })
  res.end('{}')
}
