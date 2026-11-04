import { createPublicClient, http, keccak256 } from 'viem'
import { z } from 'zod'

/**
 * simulate() on Base depends on eth_simulateV1, which not every RPC provider serves. This asks the
 * configured RPC to simulate one empty call and says whether it can, then reports whether the
 * Allowance Module is deployed there. It needs no key and prints nothing but the endpoint's answers.
 *
 *   BASE_RPC_URL=https://sepolia.base.org pnpm check:simulate
 */
const rpcUrl = z.url().safeParse(process.env['BASE_RPC_URL'] ?? 'https://sepolia.base.org')
if (!rpcUrl.success) {
  console.error('BASE_RPC_URL is not a URL')
  process.exit(1)
}

// Allowance Module 0.1.1 at its deterministic address, from Safe's safe-modules-deployments. Safe
// lists it for Base mainnet but not Sepolia (CR-005), so this reports whether the chain holds it.
const ALLOWANCE_MODULE = '0xAA46724893dedD72658219405185Fb0Fc91e091C'

const client = createPublicClient({ transport: http(rpcUrl.data) })
const host = new URL(rpcUrl.data).host
try {
  const chainId = await client.getChainId()
  const [block] = await client.simulateBlocks({
    blocks: [{ calls: [{ to: '0x0000000000000000000000000000000000000001', data: '0x' }] }],
  })
  console.log(`chain ${chainId} at ${host}: eth_simulateV1 supported (${block?.calls[0]?.status})`)
  const code = await client.getCode({ address: ALLOWANCE_MODULE })
  const deployed = code !== undefined && code !== '0x'
  // Safe deploys the module deterministically, so the address is the same on every chain; the code
  // hash lets anyone compare one chain's copy with another's.
  console.log(
    deployed
      ? `Allowance Module ${ALLOWANCE_MODULE}: deployed, code hash ${keccak256(code)}`
      : `Allowance Module ${ALLOWANCE_MODULE}: NOT deployed`,
  )
} catch (error) {
  // The first line names the failure; the rest of viem's message repeats the request body.
  const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
  console.error(`${host}: eth_simulateV1 not available`)
  console.error(`  ${reason}`)
  process.exit(1)
}
