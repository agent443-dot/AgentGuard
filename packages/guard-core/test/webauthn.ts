import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

/**
 * A software passkey for tests: a P-256 key that answers WebAuthn registration and authentication
 * the way a phone or security key would, with user verification, for one relying party.
 */
export function softAuthenticator(rpId: string, origin: string) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const credentialId = randomBytes(16)
  const id = isoBase64URL.fromBuffer(credentialId)
  const rpIdHash = createHash('sha256').update(rpId).digest()
  let counter = 0

  const jwk = publicKey.export({ format: 'jwk' })
  const cose = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, isoBase64URL.toBuffer(jwk.x ?? '')],
      [-3, isoBase64URL.toBuffer(jwk.y ?? '')],
    ]),
  )

  const clientData = (type: string, challenge: string, from = origin) =>
    Buffer.from(JSON.stringify({ type, challenge, origin: from, crossOrigin: false }))

  const authData = (flags: number, extra: Buffer = Buffer.alloc(0)) => {
    const count = Buffer.alloc(4)
    count.writeUInt32BE(++counter)
    return Buffer.concat([rpIdHash, Buffer.from([flags]), count, extra])
  }

  return {
    id,
    register(challenge: string) {
      const idLength = Buffer.alloc(2)
      idLength.writeUInt16BE(credentialId.length)
      const attested = Buffer.concat([Buffer.alloc(16), idLength, credentialId, Buffer.from(cose)])
      // User present, user verified, attested credential data included.
      const data = authData(0x01 | 0x04 | 0x40, attested)
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', new Uint8Array(data)],
        ]) as never,
      )
      return {
        id,
        rawId: id,
        type: 'public-key' as const,
        response: {
          clientDataJSON: isoBase64URL.fromBuffer(clientData('webauthn.create', challenge)),
          attestationObject: isoBase64URL.fromBuffer(attestationObject),
          transports: ['internal'],
        },
        clientExtensionResults: {},
      }
    },
    /** An assertion over `challenge`. `from` lets a test sign for another origin, as a phish would. */
    assert(challenge: string, from = origin) {
      const data = authData(0x01 | 0x04)
      const json = clientData('webauthn.get', challenge, from)
      const signed = Buffer.concat([data, createHash('sha256').update(json).digest()])
      return {
        id,
        rawId: id,
        type: 'public-key' as const,
        response: {
          clientDataJSON: isoBase64URL.fromBuffer(json),
          authenticatorData: isoBase64URL.fromBuffer(data),
          signature: isoBase64URL.fromBuffer(sign('sha256', signed, privateKey)),
        },
        clientExtensionResults: {},
      }
    },
  }
}
