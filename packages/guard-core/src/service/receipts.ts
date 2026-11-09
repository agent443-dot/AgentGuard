import type { PayIntent, Policy, Receipt } from '@agentguard/shared'
import { createHash, createPublicKey, sign, type KeyObject } from 'node:crypto'
import { getClearance, saveReceipt } from '../db/receipts.js'
import type { Db } from '../db/client.js'
import { canonicalJson } from '../domain/canonical.js'

/** Hex SHA-256 of the policy's canonical JSON: a receipt names the rules it was paid under. */
export function policyHash(policy: Policy): string {
  return createHash('sha256').update(canonicalJson(policy)).digest('hex')
}

/**
 * Signs and stores the receipt of an executed intent. A payment with no clearance on record
 * cannot have one: it never passed the pipeline, and a receipt saying otherwise would be false.
 */
export function issueReceipt(
  db: Db,
  key: KeyObject,
  intent: PayIntent,
  now: Date,
): Receipt | undefined {
  const clearance = getClearance(db, intent.id)
  if (clearance === undefined || intent.status !== 'executed') {
    return undefined
  }
  const unsigned: Omit<Receipt, 'signature'> = {
    intent,
    policyHash: clearance.policyHash,
    simulation: clearance.simulation,
    approvedBy: clearance.approvedBy,
    issuedAt: now.toISOString(),
  }
  const signature = sign(null, Buffer.from(canonicalJson(unsigned)), key).toString('hex')
  const receipt: Receipt = { ...unsigned, signature }
  saveReceipt(db, receipt)
  return receipt
}

/** The raw 32-byte Ed25519 public key in hex, what anyone needs to check a receipt. */
export function publicKeyHex(key: KeyObject): string {
  const spki = createPublicKey(key).export({ format: 'der', type: 'spki' })
  return spki.subarray(spki.length - 32).toString('hex')
}
