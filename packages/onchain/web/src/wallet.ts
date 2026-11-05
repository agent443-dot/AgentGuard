import type { VersionedTransaction } from '@solana/web3.js'

/** The part of Phantom's injected provider the page uses, and nothing more. */
export interface Wallet {
  connect(): Promise<{ publicKey: { toString(): string } }>
  signAndSendTransaction(tx: VersionedTransaction): Promise<{ signature: string }>
}

export function phantom(): Wallet | undefined {
  const provider = (globalThis as { phantom?: { solana?: Wallet & { isPhantom?: boolean } } })
    .phantom?.solana
  return provider?.isPhantom ? provider : undefined
}

/** Phantom's universal link: on a phone it opens this page inside Phantom, wallet connected. */
export function openInPhantom(page: string): string {
  const origin = new URL(page).origin
  return `https://phantom.app/ul/browse/${encodeURIComponent(page)}?ref=${encodeURIComponent(origin)}`
}
