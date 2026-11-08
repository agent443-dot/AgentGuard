import { z } from 'zod'

// decimals() — the first four bytes of keccak256("decimals()").
const DECIMALS = '0x313ce567'

const rpcResult = z.object({ result: z.string().regex(/^0x[0-9a-fA-F]*$/) })

/**
 * Asks the chain itself before trusting an address: a contract must live there, and the token must
 * report the 6 decimals every amount assumes. Errors name the setting, never a key.
 */
export async function checkContracts(
  rpc: { url: string; name: string },
  contracts: { name: string; address: string; usd?: 'USDC' | 'USDG' }[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  async function call(method: string, params: unknown[]): Promise<string> {
    const response = await fetchImpl(rpc.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    })
    return rpcResult.parse(await response.json()).result
  }

  for (const { name, address, usd } of contracts) {
    let code: string
    let decimals: string | undefined
    try {
      code = await call('eth_getCode', [address, 'latest'])
      if (usd !== undefined && code !== '0x') {
        decimals = await call('eth_call', [{ to: address, data: DECIMALS }, 'latest'])
      }
    } catch {
      throw new Error(`could not check ${name} against ${rpc.name}`)
    }
    if (code === '0x') {
      throw new Error(`${name} has no contract on this chain`)
    }
    if (
      usd !== undefined &&
      (decimals === undefined || decimals === '0x' || BigInt(decimals) !== 6n)
    ) {
      throw new Error(`${name} is not a 6-decimal token, so it is not ${usd}`)
    }
  }
}
