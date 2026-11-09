import { vaultAddress } from '../domain/address.js'
import { formatUsd } from '../domain/amount.js'
import { WizardError } from '../domain/errors.js'
import { capLink, createLink } from '../domain/links.js'
import { NETWORKS, type NetworkId } from '../domain/networks.js'
import { SECRETS, type Setup } from '../domain/plan.js'
import type { State } from '../domain/state.js'
import { heading, readSecret, saveState, type Ctx } from './context.js'

export const POLL_MS = 5_000
export const WAIT_MS = 10 * 60_000

/** The owner signs each step in Phantom on their own page; the wizard only reads the result. */
export async function vaults(ctx: Ctx, setup: Setup, state: State): Promise<void> {
  heading(ctx, 6, 'Your vaults, signed by you in Phantom')
  ctx.say('Open each link in a browser with the Phantom extension, on your owner account. The')
  ctx.say('wizard never sees that key. Before you approve, check what the page and Phantom show.')
  for (const network of setup.answers.networks) {
    if (!state.done.includes(`vault:${network}`)) {
      await vault(ctx, setup, state, network)
    }
  }
}

async function vault(ctx: Ctx, setup: Setup, state: State, network: NetworkId): Promise<void> {
  const { label, family, usd } = NETWORKS[network]
  const page = setup.pageUrl ?? ''
  const kind = family === 'solana' ? 'Squads multisig' : 'Safe'
  const cap = BigInt(setup.answers.caps[network] ?? '0')
  ctx.say()
  ctx.say(
    `${label}: first create your ${kind}${family === 'solana' ? ' (Squads charges a fee, shown on the page)' : ''}:`,
  )
  ctx.say(`  ${createLink(page, network)}`)
  let address = state.vaults[network]
  if (address === undefined) {
    address = ctx.dry
      ? `<your ${kind}>`
      : await ctx.prompt.ask({
          text: `Paste the ${kind} address the page shows.`,
          parse: (raw) => vaultAddress(network, raw),
        })
    state.vaults[network] = address
    await saveState(ctx, setup.paths, state)
  }
  ctx.say(`Then set the daily cap of ${formatUsd(cap)} ${usd} (${cap} base units):`)
  ctx.say(`  ${capLink(page, network, address, cap)}`)
  if (ctx.dry) {
    ctx.say('  would read the chain until the cap is there')
    return
  }
  try {
    await waitForCap(ctx, setup, network, address, cap)
  } catch (error) {
    // A mistyped address only shows as a cap that never appears: the rerun asks for it again.
    delete state.vaults[network]
    await saveState(ctx, setup.paths, state)
    throw error
  }
  state.done.push(`vault:${network}`)
  await saveState(ctx, setup.paths, state)
}

async function waitForCap(ctx: Ctx, setup: Setup, network: NetworkId, vault: string, cap: bigint) {
  const { label, family, usd } = NETWORKS[network]
  const rpc = await readSecret(
    ctx,
    setup.paths,
    family === 'solana' ? SECRETS.solanaRpc : SECRETS.robinhoodRpc,
  )
  const hot = setup.hot[network] ?? ''
  ctx.say('Waiting for the cap to show on the chain...')
  const deadline = ctx.now() + WAIT_MS
  while (ctx.now() < deadline) {
    const onchain = await read(ctx, network, rpc, vault, hot)
    if (onchain === cap) {
      ctx.say(
        `✓ ${label}: the chain shows a daily cap of ${formatUsd(cap)} ${usd} for your hot wallet`,
      )
      return
    }
    if (onchain !== undefined && onchain !== null) {
      throw new WizardError(
        'VAULT_MISMATCH',
        `${label}: the chain shows a cap of ${formatUsd(onchain)} ${usd}, not ${formatUsd(cap)}. Changing a cap means a kill and then a new limit (docs/self-host.md).`,
      )
    }
    await ctx.sleep(POLL_MS)
  }
  throw new WizardError(
    'VAULT_TIMEOUT',
    `${label}: no cap showed on the chain within ${WAIT_MS / 60_000} minutes. Check that Phantom confirmed both transactions, then run create-agentguard again: it continues from here and asks for the ${family === 'solana' ? 'multisig' : 'Safe'} address again.`,
  )
}

/** A failed read is retried until the deadline. Its error is dropped: it can quote the RPC URL. */
async function read(ctx: Ctx, network: NetworkId, rpc: string, vault: string, hot: string) {
  try {
    return await ctx.vault.cap(network, rpc, vault, hot)
  } catch (error) {
    if (error instanceof WizardError) {
      throw error
    }
    return undefined
  }
}
