import { startTestApi } from '../test-api/server.js'
import { startMockGuard } from './server.js'

/**
 * Runs the mock guard on :8787 and the paid test API on :8790, for the MCP inspector or the demo.
 * Credentials match .env.example's demo values.
 */
const guard = await startMockGuard({
  agentId: process.env['AGENT_ID'] || 'demo-agent',
  token: process.env['AGENT_TOKEN'] || 'demo-token',
  port: 8787,
  allowedRecipients: ['DemoRecipient1111111111111111111111111111111'],
})
const api = await startTestApi(8790)

process.stdout.write(
  `mock guard-core: ${guard.url}\n` +
    `paid test API:   ${api.url}/weather  (costs $0.01)\n` +
    `                 ${api.url}/premium  (costs $2.00, approved after 20 s)\n` +
    `                 ${api.url}/injection (body tries a prompt injection)\n` +
    `allowed recipient: DemoRecipient1111111111111111111111111111111\n`,
)
