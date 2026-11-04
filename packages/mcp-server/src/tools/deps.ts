import type { Logger } from 'pino'
import type { Guard } from '../adapters/guard.js'

export interface ToolDeps {
  guard: Guard
  log: Logger
  /** CAIP-2 chain used when `transfer` is called without one. */
  defaultChain: string
  /** The USDC token on a chain, or undefined when this server has none configured for it. */
  usdc: (chain: string) => string | undefined
}
