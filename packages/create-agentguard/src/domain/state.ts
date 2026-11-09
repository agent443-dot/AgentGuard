import { z } from 'zod'
import { answersSchema } from './answers.js'
import { NETWORK_IDS } from './networks.js'

const network = z.enum(NETWORK_IDS)

/** Progress between runs. Public values only: every secret lives in the env file or a key file. */
export const stateSchema = z.object({
  version: z.literal(1),
  answers: answersSchema.optional(),
  /** Hot wallet addresses, public. */
  hot: z.partialRecord(network, z.string()).default({}),
  pageUrl: z.string().optional(),
  /** The multisig or Safe the owner made in Phantom. */
  vaults: z.partialRecord(network, z.string()).default({}),
  /** Ids of the steps and commands that have succeeded. */
  done: z.array(z.string()).default([]),
})
export type State = z.infer<typeof stateSchema>

export function emptyState(): State {
  return { version: 1, hot: {}, vaults: {}, done: [] }
}

/** The prefixes that have a state file, from the names in ~/.agentguard. */
export function prefixesIn(names: string[]): string[] {
  return names.flatMap((name) => {
    const match = /^([a-z][a-z0-9-]*)\.state\.json$/.exec(name)
    return match?.[1] === undefined ? [] : [match[1]]
  })
}
