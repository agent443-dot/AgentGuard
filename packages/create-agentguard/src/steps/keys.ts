import { tilde } from '../domain/env.js'
import { NETWORKS } from '../domain/networks.js'
import { keyFile, type Setup } from '../domain/plan.js'
import type { State } from '../domain/state.js'
import { heading, saveState, type Ctx } from './context.js'

/**
 * One hot key per chain, made in this process into ~/.agentguard. An existing key file is kept as
 * it is: it may already hold funds, and its file name carries the network, so a testnet key is
 * never picked up for mainnet.
 */
export async function hotKeys(ctx: Ctx, setup: Setup, state: State): Promise<void> {
  heading(ctx, 3, 'Hot wallet keys, made on this machine')
  const { prefix } = setup.answers
  for (const network of setup.answers.networks) {
    const { family, label } = NETWORKS[network]
    const path = keyFile(setup.paths, prefix, network)
    let address: string
    if (await ctx.files.exists(path)) {
      address = ctx.keys.address(family, await ctx.files.read(path))
      ctx.say(`Keeping the ${label} hot key already in ${tilde(path, ctx.home)}.`)
    } else if (ctx.dry) {
      address = `<new ${label} hot wallet>`
      ctx.say(`  would generate a ${label} hot key in this process`)
      await ctx.files.write(path, '', { create: true })
    } else {
      const key = ctx.keys.generate(family)
      await ctx.files.write(path, key.contents, { create: true })
      address = key.address
    }
    state.hot[network] = address
    ctx.say(`${label} hot wallet: ${address}`)
  }
  await saveState(ctx, setup.paths, state)
}
