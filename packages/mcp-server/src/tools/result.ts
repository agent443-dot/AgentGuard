import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Logger } from 'pino'
import { GuardError } from '../adapters/guard.js'

export function text(...blocks: string[]): CallToolResult {
  return { content: blocks.map((block) => ({ type: 'text' as const, text: block })) }
}

export function failure(message: string): CallToolResult {
  return { ...text(message), isError: true }
}

/**
 * Guard errors carry messages written for the model. Anything else is a bug here, and its message
 * could hold a URL or a stack, so the model only learns that something broke.
 */
export async function guarded(
  log: Logger,
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof GuardError) {
      log.warn({ code: error.code, httpStatus: error.httpStatus }, 'guard call failed')
      return failure(error.message)
    }
    log.error({ err: error }, 'tool failed')
    return failure(
      'The AgentGuard MCP server hit an internal error. Call get_budget before retrying any payment.',
    )
  }
}
