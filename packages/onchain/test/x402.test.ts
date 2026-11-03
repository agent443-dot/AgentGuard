import { CHAINS, type PayIntent } from '@agentguard/shared'
import {
  createApproveInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import type { PaymentRequirements } from '@x402/core/types'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SigningRefused } from '../src/ChainAdapter.js'
import { svmAdapter } from '../src/svm/adapter.js'
import { inspectTransfer } from '../src/svm/inspect.js'
import { expectedTransfer } from '../src/svm/transfer.js'
import { gatedScheme, gatedSigner, type SigningGate } from '../src/svm/x402.js'
import { chain, USDC, type Chain } from './fixture.js'
import { liteConnection } from './litesvm.js'

let c: Chain
let rpc: Server
let rpcUrl: string
const merchant = Keypair.generate().publicKey
const facilitator = Keypair.generate().publicKey

// The SDK reads the mint over JSON-RPC before it builds anything; this answers from the LiteSVM
// state, so what it reads is what the token program holds.
beforeEach(async () => {
  c = chain()
  c.fund(c.hotWallet.publicKey, 10n * USDC)
  // Funded so that a failed simulation is about the payment, not a fee payer with no account.
  c.svm.airdrop(facilitator, BigInt(LAMPORTS_PER_SOL))
  rpc = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString()))
    req.on('end', () => {
      const { id, params } = JSON.parse(body) as { id: unknown; params: [string] }
      const found = c.svm.getAccount(new PublicKey(params[0]))
      const value = found && {
        data: [Buffer.from(found.data).toString('base64'), 'base64'],
        executable: found.executable,
        lamports: found.lamports,
        owner: found.owner.toBase58(),
        rentEpoch: 0,
        space: found.data.length,
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { context: { slot: 1 }, value } }))
    })
  })
  await new Promise<void>((resolve) => rpc.listen(0, '127.0.0.1', resolve))
  rpcUrl = `http://127.0.0.1:${(rpc.address() as AddressInfo).port}`
})
afterEach(() => new Promise<void>((resolve) => rpc.close(() => resolve())))

const requirements = (overrides: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
  scheme: 'exact',
  network: CHAINS.solanaDevnet,
  asset: c.mint.toBase58(),
  amount: '1000000',
  payTo: merchant.toBase58(),
  maxTimeoutSeconds: 60,
  extra: { feePayer: facilitator.toBase58(), recentBlockhash: c.svm.latestBlockhash() },
  ...overrides,
})

const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  agentId: 'agent-1',
  kind: 'x402',
  chain: CHAINS.solanaDevnet,
  token: c.mint.toBase58(),
  amount: '1000000',
  recipient: merchant.toBase58(),
  domain: 'api.example.com',
  reason: 'GET https://api.example.com/data',
  status: 'approved',
  rejectReasons: [],
  createdAt: '2026-11-03T12:00:00.000Z',
  expiresAt: '2026-11-03T12:10:00.000Z',
  ...overrides,
})

const inspectOnly = (): SigningGate => {
  const expected = expectedTransfer({
    feePayer: facilitator,
    hotWallet: c.hotWallet.publicKey,
    recipient: merchant,
    mint: c.mint,
    amount: 1_000_000n,
    decimals: 6,
  })
  return async (message) => inspectTransfer(message, expected)
}

describe('the x402 exact client behind the gate', () => {
  // The memo the SDK appends cannot run under LiteSVM here (see fixture.ts), so this gate inspects
  // and does not simulate. It proves the SDK's real transaction passes the inspection and is signed.
  it('signs the transaction the SDK builds for the agreed payment', async () => {
    const scheme = gatedScheme(c.hotWallet, inspectOnly(), rpcUrl)
    const { payload } = await scheme.createPaymentPayload(2, requirements())
    const tx = VersionedTransaction.deserialize(
      Buffer.from(String(payload['transaction']), 'base64'),
    )
    const signer = tx.message.staticAccountKeys.findIndex((key) =>
      key.equals(c.hotWallet.publicKey),
    )
    expect(tx.signatures[signer]?.some((byte) => byte !== 0)).toBe(true)
  })

  it('refuses when the SDK is asked for more than agreed', async () => {
    const scheme = gatedScheme(c.hotWallet, inspectOnly(), rpcUrl)
    await expect(
      scheme.createPaymentPayload(2, requirements({ amount: '1000001' })),
    ).rejects.toEqual(new SigningRefused(['SIM_UNEXPECTED_EFFECT']))
  })
})

describe('gatedSigner', () => {
  function unsigned(...instructions: TransactionInstruction[]) {
    const messageBytes = new TransactionMessage({
      payerKey: facilitator,
      recentBlockhash: c.svm.latestBlockhash(),
      instructions,
    })
      .compileToV0Message()
      .serialize()
    const signatures = { [facilitator.toBase58()]: null, [c.hotWallet.publicKey.toBase58()]: null }
    return { messageBytes, signatures } as unknown as Parameters<
      ReturnType<typeof gatedSigner>['signTransactions']
    >[0][number]
  }
  const source = () => getAssociatedTokenAddressSync(c.mint, c.hotWallet.publicKey)
  const pay = () =>
    createTransferCheckedInstruction(
      source(),
      c.mint,
      getAssociatedTokenAddressSync(c.mint, merchant, true),
      c.hotWallet.publicKey,
      1_000_000n,
      6,
    )

  it('signs with the hot wallet once the gate passes', async () => {
    const [signatures] = await gatedSigner(c.hotWallet, inspectOnly()).signTransactions([
      unsigned(pay()),
    ])
    expect(Object.keys(signatures ?? {})).toEqual([c.hotWallet.publicKey.toBase58()])
  })

  it('refuses with the reasons the gate gives', async () => {
    const approve = createApproveInstruction(source(), facilitator, c.hotWallet.publicKey, 1n)
    await expect(
      gatedSigner(c.hotWallet, inspectOnly()).signTransactions([unsigned(pay(), approve)]),
    ).rejects.toMatchObject({ reasons: ['DELEGATE_DETECTED'] })
  })

  it('refuses bytes that are not a message', async () => {
    const garbage = { messageBytes: new Uint8Array([0x81, 1, 2]), signatures: {} } as never
    await expect(
      gatedSigner(c.hotWallet, inspectOnly()).signTransactions([garbage]),
    ).rejects.toEqual(new SigningRefused(['SIM_FAILED']))
  })
})

describe('svmAdapter.x402Scheme', () => {
  const adapter = () =>
    svmAdapter({
      chain: CHAINS.solanaDevnet,
      connection: liteConnection(c.svm, rpcUrl),
      hotWallet: c.hotWallet,
      multisigPda: c.multisigPda,
      mint: c.mint,
    })

  it.each([
    ['another network', {}, { network: CHAINS.solanaMainnet }],
    ['another asset', {}, { asset: Keypair.generate().publicKey.toBase58() }],
    ['another recipient', {}, { payTo: facilitator.toBase58() }],
    ['another amount', {}, { amount: '2000000' }],
    ['no fee payer', {}, { extra: {} }],
    ['a fee payer that is not an address', {}, { extra: { feePayer: 'nope' } }],
  ])('refuses requirements naming %s', (_case, change, terms) => {
    expect(() => adapter().x402Scheme(intent(change), requirements(terms))).toThrow(
      new SigningRefused(['INVALID_402']),
    )
  })

  it('refuses an intent for another chain', () => {
    const other = intent({ chain: CHAINS.base })
    expect(() => adapter().x402Scheme(other, requirements())).toThrow(
      new SigningRefused(['CHAIN_NOT_ALLOWED']),
    )
  })

  // The merchant has no token account, so the transfer fails in simulation before the memo runs.
  it('simulates before signing, and refuses a payment the chain would reject', async () => {
    const scheme = adapter().x402Scheme(intent(), requirements())
    await expect(scheme.createPaymentPayload(2, requirements())).rejects.toEqual(
      new SigningRefused(['SIM_FAILED']),
    )
  })
})
