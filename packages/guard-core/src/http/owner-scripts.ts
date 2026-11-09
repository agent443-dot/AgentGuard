// The two scripts the owner's pages load from this origin. They are files, not inline code, so the
// pages' CSP can forbid inline scripts outright.

const HELPERS = `'use strict'
const fromB64 = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer
const toB64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
const status = document.getElementById('status')
const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const assert = async (options) => {
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromB64(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: fromB64(c.id) })),
    },
  })
  const r = credential.response
  return {
    id: credential.id,
    rawId: toB64(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(r.clientDataJSON),
      authenticatorData: toB64(r.authenticatorData),
      signature: toB64(r.signature),
      ...(r.userHandle ? { userHandle: toB64(r.userHandle) } : {}),
    },
  }
}
`

export const APPROVE_SCRIPT = `${HELPERS}
const data = document.getElementById('options')
const options = JSON.parse(data.textContent)
document.getElementById('approve').addEventListener('click', async () => {
  try {
    const assertion = await assert(options)
    const res = await post('/v1/owner/approve', { intentId: data.dataset.intent, assertion })
    status.textContent = res.ok ? 'Approved. You can close this page.' : 'Not approved.'
  } catch {
    status.textContent = 'Not approved: the passkey was not used.'
  }
})
`

export const ENROL_SCRIPT = `${HELPERS}
const code = new URLSearchParams(location.hash.slice(1)).get('code')
// Out of the address bar and the history once read.
history.replaceState(null, '', location.pathname)
document.getElementById('enrol').addEventListener('click', async () => {
  try {
    const asked = await post('/v1/owner/passkeys/options', { code })
    if (!asked.ok) {
      status.textContent = 'This link is no longer valid. Ask the bot for a new one.'
      return
    }
    const { registration, stepUp } = await asked.json()
    // With a passkey already enrolled, that one must vouch for the new one first.
    const assertion = stepUp ? await assert(stepUp) : undefined
    const credential = await navigator.credentials.create({
      publicKey: {
        ...registration,
        challenge: fromB64(registration.challenge),
        user: { ...registration.user, id: fromB64(registration.user.id) },
        excludeCredentials: (registration.excludeCredentials || []).map((c) => ({ ...c, id: fromB64(c.id) })),
      },
    })
    const r = credential.response
    const response = {
      id: credential.id,
      rawId: toB64(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(r.clientDataJSON),
        attestationObject: toB64(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : [],
      },
    }
    const res = await post('/v1/owner/passkeys', { code, response, ...(assertion ? { assertion } : {}) })
    status.textContent = res.ok ? 'Passkey enrolled. You can close this page.' : 'Not enrolled.'
  } catch {
    status.textContent = 'Not enrolled: the passkey was not created.'
  }
})
`
