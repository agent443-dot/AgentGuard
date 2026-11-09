import type { Amount, PayIntent } from '@agentguard/shared'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '../db/client.js'
import * as store from '../db/passkeys.js'
import { parseAmount } from '../domain/amount.js'

const ENROL_MS = 5 * 60_000
const STEP_UP_MS = 5 * 60_000
const CODE_MS = 10 * 60_000

export interface PasskeySetup {
  above: Amount
  rpId: string
  origin: string
}

type Address = Pick<PasskeySetup, 'rpId' | 'origin'>

/** Whether only a passkey may approve this intent. */
export function needsPasskey(setup: PasskeySetup | undefined, intent: PayIntent): boolean {
  return setup !== undefined && parseAmount(intent.amount) >= parseAmount(setup.above)
}

/**
 * Options for creating a passkey. `purpose` keys the challenge: the admin path has one, and each
 * enrolment code its own, so a challenge issued for one code cannot be answered with another.
 */
export async function enrolmentOptions(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId'>,
  now: Date,
  purpose = 'registration',
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpName: 'AgentGuard',
    rpID: setup.rpId,
    userName: 'owner',
    attestationType: 'none',
    // Asking for a passkey that verifies its user, so a stolen unlocked phone alone is not enough.
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    excludeCredentials: store.listPasskeys(db).map((key) => ({ id: key.id })),
  })
  store.putChallenge(db, purpose, options.challenge, new Date(now.getTime() + ENROL_MS))
  return options
}

export type Enrolled = { ok: true; id: string } | { ok: false; reason: 'exists' | 'not_verified' }

/** Stores a new passkey whose registration answers the challenge out for `purpose`. */
export async function enrol(
  db: Db,
  setup: Address,
  response: RegistrationResponseJSON,
  now: Date,
  purpose = 'registration',
): Promise<Enrolled> {
  if (store.getPasskey(db, response.id) !== undefined) {
    return { ok: false, reason: 'exists' }
  }
  const challenge = store.peekChallenge(db, purpose, now)
  if (challenge === undefined) {
    return { ok: false, reason: 'not_verified' }
  }
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: setup.origin,
    expectedRPID: setup.rpId,
    requireUserVerification: true,
  }).catch(() => undefined)
  if (result?.verified !== true) {
    return { ok: false, reason: 'not_verified' }
  }
  store.dropChallenge(db, purpose)
  const { credential } = result.registrationInfo
  store.savePasskey(db, {
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    createdAt: now.toISOString(),
    lastUsedAt: null,
  })
  return { ok: true, id: credential.id }
}

/**
 * Options for proving an enrolled passkey, under `purpose`. A challenge still out for it is
 * reused, so opening the page twice, or a link preview fetching it, does not break the first.
 */
export async function assertionOptions(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId'>,
  purpose: string,
  expiresAt: Date,
  now: Date,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const existing = store.peekChallenge(db, purpose, now)
  const options = await generateAuthenticationOptions({
    rpID: setup.rpId,
    userVerification: 'required',
    allowCredentials: store.listPasskeys(db).map((key) => ({ id: key.id })),
    ...(existing === undefined ? {} : { challenge: isoBase64URL.toBuffer(existing) }),
  })
  if (existing === undefined) {
    store.putChallenge(db, purpose, options.challenge, expiresAt)
  }
  return options
}

/** A challenge bound to this one intent, valid for as long as the intent waits for the owner. */
export function approvalOptions(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId'>,
  intent: PayIntent,
  now: Date,
) {
  return assertionOptions(db, setup, intent.id, new Date(intent.expiresAt), now)
}

/** The step-up a new enrolment needs once a passkey exists: proof from one already enrolled. */
export function stepUpOptions(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId'>,
  purpose: string,
  now: Date,
) {
  return assertionOptions(db, setup, purpose, new Date(now.getTime() + STEP_UP_MS), now)
}

/**
 * True only for an assertion from an enrolled passkey over the challenge out for `purpose`. The
 * challenge is used up only by a verified answer, so junk posted at it cannot spend it.
 */
export async function verifyAssertion(
  db: Db,
  setup: Address,
  purpose: string,
  assertion: AuthenticationResponseJSON,
  now: Date,
): Promise<boolean> {
  const challenge = store.peekChallenge(db, purpose, now)
  const passkey = store.getPasskey(db, assertion.id)
  if (challenge === undefined || passkey === undefined) {
    return false
  }
  const result = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: challenge,
    expectedOrigin: setup.origin,
    expectedRPID: setup.rpId,
    requireUserVerification: true,
    credential: {
      id: passkey.id,
      publicKey: isoBase64URL.toBuffer(passkey.publicKey),
      counter: passkey.counter,
    },
  }).catch(() => undefined)
  if (result?.verified !== true) {
    return false
  }
  store.dropChallenge(db, purpose)
  store.markUsed(db, passkey.id, result.authenticationInfo.newCounter, now)
  return true
}

/** A one-time code for the public enrolment page: shown once, stored only as its hash. */
export function issueEnrolCode(db: Db, now: Date): { code: string; expiresAt: string } {
  const code = randomBytes(24).toString('base64url')
  const expiresAt = new Date(now.getTime() + CODE_MS)
  store.putEnrolCode(db, codeHash(code), expiresAt)
  return { code, expiresAt: expiresAt.toISOString() }
}

export function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}
