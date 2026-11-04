import { createPublicClient, http } from 'viem'
import { z } from 'zod'

/**
 * simulate() on Base depends on eth_simulateV1, which not every RPC provider serves. This asks the
 * configured RPC to simulate one empty call and says whether it can. It needs no key and prints
 * nothing but the endpoint's answer.
 *
 *   BASE_RPC_URL=https://sepolia.base.org pnpm check:simulate
 */
const rpcUrl = z.url().safeParse(process.env['BASE_RPC_URL'] ?? 'https://sepolia.base.org')
if (!rpcUrl.success) {
  console.error('BASE_RPC_URL is not a URL')
  process.exit(1)
}

const client = createPublicClient({ transport: http(rpcUrl.data) })
const host = new URL(rpcUrl.data).host
try {
  const chainId = await client.getChainId()
  const [block] = await client.simulateBlocks({
    blocks: [{ calls: [{ to: '0x0000000000000000000000000000000000000001', data: '0x' }] }],
  })
  console.log(`chain ${chainId} at ${host}: eth_simulateV1 supported (${block?.calls[0]?.status})`)
} catch (error) {
  // The first line names the failure; the rest of viem's message repeats the request body.
  const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
  console.error(`${host}: eth_simulateV1 not available`)
  console.error(`  ${reason}`)
  process.exit(1)
}
