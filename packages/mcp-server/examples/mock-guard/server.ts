import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CHAINS } from '@agentguard/shared'

/**
 * A stand-in for guard-core's agent API, faithful to the SPEC's request and response shapes and
 * nothing more. Its "policy" is a few fixed rules so every result the MCP tools can show is easy to
 * reach by hand in the MCP inspector:
 *
 * - x402 fetch refuses a host not in `allowedDomains` before any request (no intent). It calls the
 *   URL; an answer other than 402 passes straight through with no intent. A 402 costs $0.01 and is
 *   paid with a fake payment header; under a "/premium" path it costs $2.00 and needs approval.
 * - transfer to a recipient outside `allowedRecipients` is rejected; $1.00 or more needs approval.
 * - after `approveAfterMs` a pending transfer executes, and a pending x402 payment becomes approved.
 *   Repeating the same fetch then redeems that approval once, as guard-core does.
 */
export interface MockGuardOptions {
  agentId: string
  token: string
  port?: number
  allowedDomains?: string[]
  allowedRecipients?: string[]
  approveAfterMs?: number
  now?: () => Date
}

export interface MockIntent {
  id: string
  agentId: string
  kind: 'x402' | 'transfer'
  chain: string
  token: string
  amount: string
  recipient: string
  domain?: string
  reason: string
  status: 'approved' | 'pending_approval' | 'rejected' | 'executed' | 'failed' | 'expired'
  rejectReasons: string[]
  txId?: string
  createdAt: string
  expiresAt: string
}

export interface MockGuard {
  url: string
  intents: Map<string, MockIntent>
  requests: { method: string; path: string; body: unknown }[]
  close(): Promise<void>
}

const CHEAP = 10_000n
const PREMIUM = 2_000_000n
const APPROVAL_THRESHOLD = 1_000_000n
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

export async function startMockGuard(options: MockGuardOptions): Promise<MockGuard> {
  const {
    agentId,
    token,
    port = 0,
    allowedDomains = ['localhost', '127.0.0.1'],
    allowedRecipients = [],
    approveAfterMs = 20_000,
    now = () => new Date(),
  } = options
  const intents = new Map<string, MockIntent>()
  const requests: MockGuard['requests'] = []
  let spent = 0n

  function settle(intent: MockIntent) {
    const pending = intent.status === 'pending_approval'
    if (pending && now().getTime() - Date.parse(intent.createdAt) >= approveAfterMs) {
      if (intent.kind === 'x402') {
        intent.status = 'approved'
      } else {
        execute(intent)
      }
    }
    return intent
  }

  function record(fields: Omit<MockIntent, 'id' | 'agentId' | 'createdAt' | 'expiresAt'>) {
    const created = now()
    const intent: MockIntent = {
      id: randomUUID(),
      agentId,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + 10 * 60_000).toISOString(),
      ...fields,
    }
    if (intent.status === 'executed') {
      execute(intent)
    }
    intents.set(intent.id, intent)
    return intent
  }

  function execute(intent: MockIntent) {
    intent.status = 'executed'
    intent.txId = `mock-tx-${intent.id.slice(0, 8)}`
    spent += BigInt(intent.amount)
  }

  async function call(url: URL, method: string, paid: boolean) {
    const response = await fetch(url, {
      method,
      headers: paid ? { 'x-payment': 'mock-payment' } : {},
    })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => (headers[key] = value))
    return { status: response.status, headers, body: await response.text() }
  }

  async function x402(body: Record<string, unknown>) {
    const url = new URL(String(body['url']))
    const method = String(body['method'] ?? 'GET')
    if (!allowedDomains.includes(url.hostname)) {
      return { status: 'rejected', rejectReasons: ['DOMAIN_NOT_ALLOWED'] }
    }
    const free = await call(url, method, false)
    if (free.status !== 402) {
      return { rejectReasons: [], response: free }
    }
    const amount = url.pathname.includes('/premium') ? PREMIUM : CHEAP
    const approved = [...intents.values()].find(
      (intent) =>
        intent.kind === 'x402' &&
        settle(intent).status === 'approved' &&
        intent.domain === url.hostname &&
        intent.amount === amount.toString(),
    )
    if (approved) {
      execute(approved)
      const response = await call(url, method, true)
      return { intentId: approved.id, status: 'executed', rejectReasons: [], response }
    }
    const max = typeof body['maxAmount'] === 'string' ? BigInt(body['maxAmount']) : undefined
    const reasons = max !== undefined && amount > max ? ['PER_TX_EXCEEDED'] : []
    const status =
      reasons.length > 0
        ? 'rejected'
        : amount >= APPROVAL_THRESHOLD
          ? 'pending_approval'
          : 'executed'
    const intent = record({
      kind: 'x402',
      chain: CHAINS.solanaDevnet,
      token: USDC_DEVNET,
      amount: amount.toString(),
      recipient: 'mock-pay-to',
      domain: url.hostname,
      reason: '',
      status,
      rejectReasons: reasons,
    })
    const result = { intentId: intent.id, status, rejectReasons: reasons }
    return status === 'executed' ? { ...result, response: await call(url, method, true) } : result
  }

  function transfer(body: Record<string, unknown>) {
    const amount = BigInt(String(body['amount']))
    const recipient = String(body['recipient'])
    const reasons = allowedRecipients.includes(recipient) ? [] : ['RECIPIENT_NOT_ALLOWED']
    const status =
      reasons.length > 0
        ? 'rejected'
        : amount >= APPROVAL_THRESHOLD
          ? 'pending_approval'
          : 'executed'
    const intent = record({
      kind: 'transfer',
      chain: String(body['chain']),
      token: String(body['token']),
      amount: amount.toString(),
      recipient,
      reason: String(body['reason']),
      status,
      rejectReasons: reasons,
    })
    return { intentId: intent.id, status, txId: intent.txId, rejectReasons: reasons }
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? '/', 'http://mock').pathname
    const body = req.method === 'POST' ? await readJson(req) : undefined
    requests.push({ method: req.method ?? '', path, body })
    if (req.headers.authorization !== `Bearer ${token}`) {
      return send(res, 401, { error: 'unauthorized' })
    }
    if (req.method === 'POST' && path === '/v1/agent/x402/fetch') {
      return send(res, 200, await x402(body ?? {}))
    }
    if (req.method === 'POST' && path === '/v1/agent/transfer') {
      return send(res, 200, transfer(body ?? {}))
    }
    if (req.method === 'GET' && path === `/v1/agent/budget/${agentId}`) {
      return send(res, 200, {
        spentToday: spent.toString(),
        dailyMax: '5000000',
        perTxMax: '2000000',
        hotWalletBalances: { [CHAINS.solanaDevnet]: '10000000' },
        chains: [CHAINS.solanaDevnet],
        paused: false,
      })
    }
    const intent = intents.get(path.replace('/v1/agent/intents/', ''))
    if (req.method === 'GET' && path.startsWith('/v1/agent/intents/') && intent) {
      return send(res, 200, settle(intent))
    }
    return send(res, 404, { error: 'not_found' })
  }

  const server: Server = createServer((req, res) => {
    route(req, res).catch(() => send(res, 500, { error: 'internal_error' }))
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const { port: bound } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${bound}`,
    intents,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  // The only caller is the MCP server under test; a malformed body fails the request with a 500.
  // eslint-disable-next-line no-restricted-properties
  return text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}
