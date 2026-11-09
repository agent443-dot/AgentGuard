import { getAddress, isAddress } from 'viem'
import { WizardError } from './errors.js'
import { NETWORKS, type NetworkId } from './networks.js'

const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** A pasted multisig or Safe address, checked for its chain's format before anything uses it. */
export function vaultAddress(network: NetworkId, raw: string): string {
  const value = raw.trim()
  if (NETWORKS[network].family === 'solana') {
    if (!base58.test(value)) {
      throw new WizardError('INVALID_INPUT', 'a Squads multisig address is 32 to 44 base58 letters')
    }
    return value
  }
  // Strict: a mixed-case address must carry a valid checksum, which catches most typos.
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || !isAddress(value)) {
    throw new WizardError('INVALID_INPUT', 'a Safe address is 0x and 40 hex digits')
  }
  return getAddress(value)
}

/** The page's origin: the bot refuses a SIGN_PAGE_URL with a path, query or fragment. */
export function pageOrigin(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new WizardError(
      'INVALID_INPUT',
      'expected the page address, like https://my-page.vercel.app',
    )
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new WizardError('INVALID_INPUT', 'expected https:// and the host only, with no path')
  }
  return url.origin
}
