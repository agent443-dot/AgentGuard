/** Phantom's injected EVM provider: EIP-1193, the one call the page needs. */
export interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export function phantomEvm(): Eip1193 | undefined {
  const provider = (globalThis as { phantom?: { ethereum?: Eip1193 & { isPhantom?: boolean } } })
    .phantom?.ethereum
  return provider?.isPhantom ? provider : undefined
}

/** Puts Phantom on the chain, and says whether it got there. */
export async function onChain(wallet: Eip1193, chainId: number): Promise<boolean> {
  const current = async () => Number(await wallet.request({ method: 'eth_chainId' }))
  if ((await current()) !== chainId) {
    await wallet.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
  }
  return (await current()) === chainId
}
