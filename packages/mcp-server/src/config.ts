import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'
import { isLoopback } from './domain/loopback.js'

/**
 * The agent token rides on every request, so plain http is allowed only where it never leaves the
 * machine. One refine that cannot throw: zod runs a chained refine even after the first one failed.
 */
const guardUrl = z.string().refine((value) => {
  try {
    const { protocol, hostname, username, password } = new URL(value)
    // A token in the URL ends up in logs and process listings; it belongs in AGENT_TOKEN.
    if (username !== '' || password !== '') {
      return false
    }
    return protocol === 'https:' || (protocol === 'http:' && isLoopback(hostname))
  } catch {
    return false
  }
}, 'expected https://, or http:// to localhost, 127.0.0.1 or [::1], with no credentials in it')

export const configSchema = z
  .object({
    GUARD_URL: guardUrl,
    AGENT_ID: z.string().min(1).max(64),
    AGENT_TOKEN: z.string().min(1),
    DEFAULT_CHAIN: z.enum(Object.values(CHAINS)).default(CHAINS.solanaDevnet),
    /** USDC on Base mainnet, until shared carries a verified address for it. Ignored on other chains. */
    BASE_USDC: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 0x address')
      .optional(),
    MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
    MCP_HTTP_HOST: z.string().min(1).default('127.0.0.1'),
    MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8789),
    MCP_HTTP_TOKEN: z.string().min(32, 'use at least 32 characters').optional(),
    /** Binding beyond this machine is a decision, not a default. */
    MCP_HTTP_ALLOW_REMOTE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Requests per minute per client address. */
    MCP_HTTP_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(60),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .refine((config) => config.MCP_TRANSPORT !== 'http' || config.MCP_HTTP_TOKEN !== undefined, {
    // Over HTTP, anyone who reaches the port could spend as this agent.
    message: 'required when MCP_TRANSPORT=http',
    path: ['MCP_HTTP_TOKEN'],
  })
  .refine((config) => isLoopback(config.MCP_HTTP_HOST) || config.MCP_HTTP_ALLOW_REMOTE, {
    message: 'a non-loopback host needs MCP_HTTP_ALLOW_REMOTE=true',
    path: ['MCP_HTTP_HOST'],
  })

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    // Field names and messages only: the values include the agent token.
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join('.')} (${issue.message})`)
      .join(', ')
    throw new Error(`invalid configuration: ${fields}`)
  }
  return parsed.data
}
