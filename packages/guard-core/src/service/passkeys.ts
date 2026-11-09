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

export interface PasskeySetup {
  above: Amount
  rpId: string
  origin: string
}

/** Whether only a passkey may approve this intent. */
export function needsPasskey(setup: PasskeySetup | undefined, intent: PayIntent): boolean {
  return setup !== undefined && parseAmount(intent.amount) >= parseAmount(setup.above)
}

/**
 * `purpose` keys the challenge: the admin path has one, and each enrolment code its own, so a
 * challenge issued for one code cannot be answered with another.
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

export async function enrol(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId' | 'origin'>,
  response: RegistrationResponseJSON,
  now: Date,
  purpose = 'registration',
): Promise<boolean> {
  const challenge = store.takeChallenge(db, purpose, now)
  if (challenge === undefined) {
    return false
  }
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: setup.origin,
    expectedRPID: setup.rpId,
    requireUserVerification: true,
  }).catch(() => undefined)
  if (result?.verified !== true) {
    return false
  }
  const { credential } = result.registrationInfo
  store.savePasskey(db, {
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    createdAt: now.toISOString(),
  })
  return true
}

/** A challenge bound to this one intent, valid for as long as the intent waits for the owner. */
export async function approvalOptions(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId'>,
  intent: PayIntent,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: setup.rpId,
    userVerification: 'required',
    allowCredentials: store.listPasskeys(db).map((key) => ({ id: key.id })),
  })
  store.putChallenge(db, intent.id, options.challenge, new Date(intent.expiresAt))
  return options
}

/** True only for an assertion from an enrolled passkey over this intent's own challenge. */
export async function verifyApproval(
  db: Db,
  setup: Pick<PasskeySetup, 'rpId' | 'origin'>,
  intent: PayIntent,
  assertion: AuthenticationResponseJSON,
  now: Date,
): Promise<boolean> {
  const challenge = store.takeChallenge(db, intent.id, now)
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
  store.setCounter(db, passkey.id, result.authenticationInfo.newCounter)
  return true
}

const CODE_MS = 10 * 60_000

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
