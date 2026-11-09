import { requireAddress } from '@agentguard/shared'
import { PublicKey } from '@solana/web3.js'
import { createPublicClient, getAddress, http } from 'viem'
import { robinhood, robinhoodTestnet } from 'viem/chains'
// onchain's index exports the adapters only. These readers are the ones its status scripts use,
// imported by path so the wizard reads the cap exactly as onchain does instead of a second copy.
import { hasAllowance, readAllowance } from '../../../onchain/src/evm/safe.js'
import { connect, findSpendingLimit, spendingLimitPda } from '../../../onchain/src/svm/squads.js'
import { WizardError } from '../domain/errors.js'
import { NETWORKS, usdToken, type NetworkId } from '../domain/networks.js'

export interface VaultReader {
  /** The daily cap the hot wallet may draw, in base units, or null when there is none yet. */
  cap(network: NetworkId, rpcUrl: string, vault: string, hot: string): Promise<bigint | null>
}

async function squadsCap(rpcUrl: string, multisig: string, hot: string): Promise<bigint | null> {
  const limit = spendingLimitPda(new PublicKey(multisig), new PublicKey(hot))
  const state = await findSpendingLimit(connect(rpcUrl), limit)
  if (state === null) {
    return null
  }
  const onlyHot = (keys: string[]) => keys.length === 1 && keys[0] === hot
  if (!onlyHot(state.members) || !onlyHot(state.destinations)) {
    throw new WizardError(
      'VAULT_MISMATCH',
      `the spending limit's only member and destination must be your hot wallet ${hot}`,
    )
  }
  return BigInt(state.cap)
}

async function safeCap(network: NetworkId, rpcUrl: string, safe: string, hot: string) {
  const chain = network === 'robinhood-mainnet' ? robinhood : robinhoodTestnet
  const client = createPublicClient({ chain, transport: http(rpcUrl) })
  const module = getAddress(requireAddress(NETWORKS[network].chain, 'allowanceModule'))
  const [safeAddress, delegate] = [getAddress(safe), getAddress(hot)]
  const allowance = await readAllowance(
    client,
    module,
    safeAddress,
    delegate,
    getAddress(usdToken(network)),
  )
  const drawing = await hasAllowance(client, module, safeAddress, delegate, allowance)
  return drawing ? allowance.amount : null
}

export const chainVault: VaultReader = {
  cap: (network, rpcUrl, vault, hot) =>
    NETWORKS[network].family === 'solana'
      ? squadsCap(rpcUrl, vault, hot)
      : safeCap(network, rpcUrl, vault, hot),
}
