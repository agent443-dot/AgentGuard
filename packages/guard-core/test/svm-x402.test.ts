import type { PayIntent } from '@agentguard/shared'
import { generateKeyPairSigner, type TransactionPartialSigner } from '@solana/kit'
import {
  createApproveInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  type TransactionInstruction,
} from '@solana/web3.js'
import type { PaymentRequirements } from '@x402/core/types'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { expectedTransfer, gatedSigner, svmPaymentScheme } from '../src/adapters/svm-x402.js'
import { SigningRefused } from '../src/adapters/x402.js'
import { CHAIN } from './harness.js'

const mint = Keypair.generate().publicKey
const merchant = Keypair.generate().publicKey
const feePayer = Keypair.generate().publicKey
const blockhash = Keypair.generate().publicKey.toBase58()

let wallet: TransactionPartialSigner
let owner: PublicKey
let intent: PayIntent
let requirements: PaymentRequirements

beforeAll(async () => {
  wallet = await generateKeyPairSigner()
  owner = new PublicKey(wallet.address)
  requirements = {
    scheme: 'exact',
    network: CHAIN,
    asset: mint.toBase58(),
    amount: '1000000',
    payTo: merchant.toBase58(),
    maxTimeoutSeconds: 60,
    extra: { feePayer: feePayer.toBase58(), recentBlockhash: blockhash },
  }
  intent = {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    agentId: 'agent-1',
    kind: 'x402',
    chain: CHAIN,
    token: requirements.asset,
    amount: requirements.amount,
    recipient: requirements.payTo,
    domain: 'api.example.com',
    reason: 'GET https://api.example.com/data',
    status: 'approved',
    rejectReasons: [],
    createdAt: '2026-11-03T12:00:00.000Z',
    expiresAt: '2026-11-03T12:10:00.000Z',
  }
})

function message(...instructions: TransactionInstruction[]) {
  const bytes = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions,
  })
    .compileToV0Message()
    .serialize()
  const signatures = { [feePayer.toBase58()]: null, [wallet.address]: null }
  return { messageBytes: bytes, signatures } as unknown as Parameters<
    TransactionPartialSigner['signTransactions']
  >[0][number]
}

function payment(amount = 1_000_000n) {
  return createTransferCheckedInstruction(
    getAssociatedTokenAddressSync(mint, owner),
    mint,
    getAssociatedTokenAddressSync(mint, merchant, true),
    owner,
    amount,
    6,
  )
}

describe('gatedSigner', () => {
  const signer = () => gatedSigner(wallet, expectedTransfer(intent, requirements, wallet.address))

  it('signs the one transfer the intent describes', async () => {
    const [signatures] = await signer().signTransactions([message(payment())])
    expect(Object.keys(signatures ?? {})).toEqual([wallet.address])
  })

  it('refuses a transfer of a different amount', async () => {
    await expect(signer().signTransactions([message(payment(1_000_001n))])).rejects.toEqual(
      new SigningRefused(['SIM_UNEXPECTED_EFFECT']),
    )
  })

  it('refuses an approval riding along with the payment', async () => {
    const approve = createApproveInstruction(
      getAssociatedTokenAddressSync(mint, owner),
      Keypair.generate().publicKey,
      owner,
      2n ** 64n - 1n,
    )
    await expect(signer().signTransactions([message(payment(), approve)])).rejects.toMatchObject({
      reasons: ['DELEGATE_DETECTED'],
    })
  })

  it('refuses requirements that name no fee payer', () => {
    expect(() => expectedTransfer(intent, { ...requirements, extra: {} }, wallet.address)).toThrow(
      SigningRefused,
    )
  })

  it('refuses a recipient that is not an address', () => {
    expect(() =>
      expectedTransfer({ ...intent, recipient: 'not base58!' }, requirements, wallet.address),
    ).toThrow(SigningRefused)
  })
})

describe('svmPaymentScheme with the real SDK', () => {
  let rpc: Server

  // Answers the one call the SDK makes when the 402 carries a blockhash: reading the mint.
  beforeAll(async () => {
    const data = Buffer.alloc(MINT_SIZE)
    MintLayout.encode(
      {
        mintAuthorityOption: 0,
        mintAuthority: PublicKey.default,
        supply: 0n,
        decimals: 6,
        isInitialized: true,
        freezeAuthorityOption: 0,
        freezeAuthority: PublicKey.default,
      },
      data,
    )
    rpc = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString()))
      req.on('end', () => {
        const { id } = JSON.parse(body) as { id: unknown }
        const value = {
          data: [data.toString('base64'), 'base64'],
          executable: false,
          lamports: 1_461_600,
          owner: TOKEN_PROGRAM_ID.toBase58(),
          rentEpoch: 0,
          space: MINT_SIZE,
        }
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { context: { slot: 1 }, value } }))
      })
    })
    await new Promise<void>((resolve) => rpc.listen(0, '127.0.0.1', resolve))
  })
  afterAll(() => new Promise<void>((resolve) => rpc.close(() => resolve())))

  // The SDK always appends a Memo instruction, and onchain's inspectTransfer does not allow the Memo
  // program yet (message sent to onchain, 2026-11-03). Everything else in the SDK's transaction
  // passes. When the Memo is allowed this test fails, and should then expect a signed payload.
  it('reaches the inspection with the SDK transaction, and refuses only its Memo', async () => {
    const { port } = rpc.address() as AddressInfo
    const scheme = svmPaymentScheme(CHAIN, wallet, `http://127.0.0.1:${port}`)
    await expect(
      scheme.forIntent(intent, requirements).createPaymentPayload(2, requirements),
    ).rejects.toEqual(new SigningRefused(['UNKNOWN_PROGRAM_DETECTED']))
  })
})
