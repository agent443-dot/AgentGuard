import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'

const httpUrl = z.string().refine((value) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}, 'expected an http(s) url')

export const configSchema = z
  .object({
    GUARD_URL: httpUrl,
    AGENT_ID: z.string().min(1).max(64),
    AGENT_TOKEN: z.string().min(1),
    DEFAULT_CHAIN: z.enum(Object.values(CHAINS)).default(CHAINS.solanaDevnet),
    /** USDC on the Base chain guard-core runs, until shared carries a verified address for it. */
    BASE_USDC: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 0x address')
      .optional(),
    MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
    MCP_HTTP_HOST: z.string().min(1).default('127.0.0.1'),
    MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8789),
    MCP_HTTP_TOKEN: z.string().min(32, 'use at least 32 characters').optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .refine((config) => config.MCP_TRANSPORT !== 'http' || config.MCP_HTTP_TOKEN !== undefined, {
    // Over HTTP, anyone who reaches the port could spend as this agent.
    message: 'required when MCP_TRANSPORT=http',
    path: ['MCP_HTTP_TOKEN'],
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
