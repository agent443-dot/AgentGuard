import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readReceiptKeyFile } from '../src/adapters/keypair.js'
import { getPolicy } from '../src/db/repo.js'
import { canonicalJson } from '../src/domain/canonical.js'
import { ADMIN_TOKEN, CHAIN, harness, MERCHANT, MINT, type Harness } from './harness.js'

const { privateKey } = generateKeyPairSync('ed25519')

const pay = (h: Harness, amount = '1000000') =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient: MERCHANT,
    reason: 'pay',
  })

const receiptOf = (h: Harness, id: string) => h.agent('GET', `/v1/agent/intents/${id}/receipt`)

/** Checks a receipt the way an outsider would: only the published key and the receipt. */
async function checks(h: Harness, receipt: Record<string, unknown>): Promise<boolean> {
  const { publicKey } = (await h.app.inject({ method: 'GET', url: '/v1/receipts/key' })).json()
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
  const key = createPublicKey({
    key: Buffer.concat([spkiPrefix, Buffer.from(publicKey, 'hex')]),
    format: 'der',
    type: 'spki',
  })
  const { signature, ...signed } = receipt
  return verify(
    null,
    Buffer.from(canonicalJson(signed)),
    key,
    Buffer.from(String(signature), 'hex'),
  )
}

describe('canonicalJson', () => {
  it('sorts keys at every depth and keeps arrays in order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    )
  })
})

describe('signed receipts', () => {
  it('issues one for an executed payment that anyone can check with the published key', async () => {
    const h = await harness({ receiptKey: privateKey })
    const paid = (await pay(h)).json()
    const res = await receiptOf(h, paid.intentId)
    expect(res.statusCode).toBe(200)
    const receipt = res.json()
    expect(receipt).toMatchObject({
      intent: { id: paid.intentId, status: 'executed' },
      approvedBy: 'policy',
      simulation: expect.any(String),
    })
    const policy = getPolicy(h.db, 'agent-1')
    expect(receipt.policyHash).toBe(
      createHash('sha256').update(canonicalJson(policy)).digest('hex'),
    )
    expect(await checks(h, receipt)).toBe(true)
    expect(await checks(h, { ...receipt, approvedBy: 'owner' })).toBe(false)
  })

  it("says the owner approved one that went through the owner's tap", async () => {
    const h = await harness({ receiptKey: privateKey })
    const pending = (await pay(h, '3000000')).json()
    await h.asBot({ intentId: pending.intentId, decision: 'approve', telegramUserId: '1' })
    expect((await receiptOf(h, pending.intentId)).json().approvedBy).toBe('owner')
  })

  it('has none for a payment that did not execute, or for an unknown id', async () => {
    const h = await harness({ receiptKey: privateKey })
    const pending = (await pay(h, '3000000')).json()
    expect((await receiptOf(h, pending.intentId)).statusCode).toBe(404)
    expect((await receiptOf(h, '22222222-2222-4222-8222-222222222222')).statusCode).toBe(404)
  })

  it('lists them for the owner by period', async () => {
    const h = await harness({ receiptKey: privateKey })
    await pay(h)
    await pay(h)
    const res = await h.app.inject({
      method: 'GET',
      url: '/v1/admin/receipts',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    })
    expect(res.json().receipts).toHaveLength(2)
  })

  it('stays off without a key, and pays all the same', async () => {
    const h = await harness()
    const paid = (await pay(h)).json()
    expect(paid.status).toBe('executed')
    expect((await receiptOf(h, paid.intentId)).statusCode).toBe(404)
    expect((await h.app.inject({ method: 'GET', url: '/v1/receipts/key' })).statusCode).toBe(404)
  })
})

describe('the receipt key file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-receipt-'))
  const file = (name: string, contents: string) => {
    const path = join(dir, name)
    writeFileSync(path, contents, { mode: 0o600 })
    return path
  }

  it('reads an Ed25519 key in PEM', async () => {
    const path = file('ok.pem', privateKey.export({ format: 'pem', type: 'pkcs8' }).toString())
    expect((await readReceiptKeyFile(path)).asymmetricKeyType).toBe('ed25519')
  })

  it.each([
    [
      'another algorithm',
      () =>
        generateKeyPairSync('ec', { namedCurve: 'P-256' })
          .privateKey.export({ format: 'pem', type: 'pkcs8' })
          .toString(),
    ],
    ['not a key', () => 'this is not a key, and must not be quoted'],
  ])('refuses %s by path only', async (_case, contents) => {
    const path = file('bad.pem', contents())
    await expect(readReceiptKeyFile(path)).rejects.toThrow(`invalid receipt key file: ${path}`)
    await expect(readReceiptKeyFile(path)).rejects.not.toThrow(/quoted|BEGIN/)
  })
})
