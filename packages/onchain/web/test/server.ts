import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Keypair } from '@solana/web3.js'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { z } from 'zod'
import { FailedTransactionMetadata, type Svm } from '../../test/svm.js'

const programAccountsConfig = z.object({
  filters: z
    .array(
      z.object({
        memcmp: z.object({
          offset: z.number(),
          bytes: z.string(),
          encoding: z.enum(['base58', 'base64']).optional(),
        }),
      }),
    )
    .optional(),
})

const rpcRequest = z.object({
  id: z.union([z.number(), z.string()]),
  method: z.string(),
  params: z.array(z.unknown()).default([]),
})

/**
 * The page's whole world in one local server: its built files, a JSON-RPC endpoint answered by
 * LiteSVM with the real Squads program, and a stand-in for Phantom that records every transaction
 * it is asked to sign, signs it with `wallet`, and sends it.
 */
export async function servePage(
  svm: Svm,
  dist: string,
  wallet: () => Keypair,
  /** LiteSVM cannot list accounts, so getProgramAccounts scans the ones a test registers here. */
  scanned: PublicKey[] = [],
) {
  const signed: VersionedTransaction[] = []

  const account = (address: string) => {
    const info = svm.getAccount(new PublicKey(address))
    return info
      ? {
          data: [Buffer.from(info.data).toString('base64'), 'base64'],
          executable: info.executable,
          lamports: info.lamports,
          owner: info.owner.toBase58(),
          rentEpoch: 0,
          space: info.data.length,
        }
      : null
  }
  const context = { slot: 1 }
  /** Methods this RPC refuses, as some public RPCs refuse getProgramAccounts. */
  const refused = new Set<string>()
  const methods: Record<string, (params: unknown[]) => unknown> = {
    getMultipleAccounts: ([addresses]) => ({
      context,
      value: z.array(z.string()).parse(addresses).map(account),
    }),
    getAccountInfo: ([address]) => ({ context, value: account(z.string().parse(address)) }),
    getProgramAccounts: ([program, config]) => {
      const { filters = [] } = programAccountsConfig.parse(config ?? {})
      return scanned.flatMap((address) => {
        const info = svm.getAccount(address)
        const matches =
          info?.owner.toBase58() === z.string().parse(program) &&
          filters.every(({ memcmp: { offset, bytes, encoding } }) => {
            const want = encoding === 'base64' ? Buffer.from(bytes, 'base64') : bs58.decode(bytes)
            return Buffer.from(info.data.subarray(offset, offset + want.length)).equals(want)
          })
        return matches ? [{ pubkey: address.toBase58(), account: account(address.toBase58()) }] : []
      })
    },
    getLatestBlockhash: () => ({
      context,
      value: { blockhash: svm.latestBlockhash(), lastValidBlockHeight: 1000 },
    }),
  }

  async function sign(body: string) {
    const tx = VersionedTransaction.deserialize(Buffer.from(body, 'base64'))
    signed.push(VersionedTransaction.deserialize(tx.serialize()))
    tx.sign([wallet()])
    const result = svm.sendTransaction(tx)
    svm.expireBlockhash()
    if (result instanceof FailedTransactionMetadata) {
      throw new Error(result.toString())
    }
    return { signature: Buffer.from(result.signature()).toString('hex') }
  }

  const served = await serve(dist, {
    '/rpc': jsonRpc(
      Object.fromEntries(
        Object.entries(methods).map(([name, handler]) => [
          name,
          (params: unknown[]) => {
            if (refused.has(name)) {
              throw new JsonRpcError(-32601, `${name} is disabled on this RPC`)
            }
            return handler(params)
          },
        ]),
      ),
    ),
    '/wallet': async (body) => JSON.stringify(await sign(body)),
  })
  return { ...served, dist, signed, refused }
}

/** A JSON-RPC endpoint over `methods`; a method that throws a JsonRpcError answers with it. */
export function jsonRpc(methods: Record<string, (params: unknown[]) => unknown>) {
  return async (body: string) => {
    const { id, method, params } = rpcRequest.parse(JSON.parse(body))
    const handler = methods[method]
    if (!handler) {
      throw new Error(`test RPC: ${method} not served`)
    }
    try {
      return JSON.stringify({ jsonrpc: '2.0', id, result: await handler(params) })
    } catch (error) {
      if (error instanceof JsonRpcError) {
        return JSON.stringify({ jsonrpc: '2.0', id, error: { ...error } })
      }
      throw error
    }
  }
}

export class JsonRpcError {
  constructor(
    readonly code: number,
    readonly message: string,
    readonly data?: string,
  ) {}
}

/** The built page's files, and a JSON answer from `routes` for each POST path. */
export async function serve(
  dist: string,
  routes: Record<string, (body: string) => Promise<string>>,
) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = Object.hasOwn(routes, url.pathname) ? routes[url.pathname] : undefined
      if (req.method === 'POST' && route) {
        const answer = await route(await text(req))
        res.setHeader('content-type', 'application/json')
        res.end(answer)
        return
      }
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
      const types: Record<string, string> = {
        html: 'text/html',
        js: 'text/javascript',
        css: 'text/css',
      }
      res.setHeader(
        'content-type',
        types[file.split('.').pop() ?? ''] ?? 'application/octet-stream',
      )
      res.end(await readFile(`${dist}/${file}`))
    } catch (error) {
      res.statusCode = 500
      res.end(String(error))
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  // Pages stay open across a suite, and their keep-alive sockets would hold close() for a minute.
  const close = () => {
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  }
  return { origin, close }
}

async function text(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Phantom's injected provider as the page sees it, backed by the server's /wallet endpoint. */
export function mockPhantom(publicKey: string, rejects = false): string {
  return `
    window.phantom = { solana: {
      isPhantom: true,
      // Phantom's real provider compiles zod schemas with new Function in the page's own world, so
      // the stand-in does too: a CSP without 'unsafe-eval' breaks connect, as it did live.
      connect: async () => ({
        publicKey: { toString: new Function('return ' + ${JSON.stringify(JSON.stringify(publicKey))}) },
      }),
      signAndSendTransaction: async (tx) => {
        if (${String(rejects)}) throw new Error('User rejected the request.')
        let raw = ''
        for (const byte of tx.serialize()) raw += String.fromCharCode(byte)
        const res = await fetch('/wallet', { method: 'POST', body: btoa(raw) })
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      },
    } }`
}
