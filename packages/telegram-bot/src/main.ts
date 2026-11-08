import { pino } from 'pino'
import { httpGuardClient } from './adapters/guard.js'
import { createBot } from './bot/index.js'
import { loadConfig } from './config.js'
import { phantomKillUrl } from './domain/phantom.js'
import { buildServer } from './http/server.js'

const EXPIRY_SWEEP_MS = 15_000

const config = loadConfig()
const log = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers["x-guard-signature"]'],
})

const guard = httpGuardClient({
  url: config.GUARD_URL,
  botToken: config.GUARD_BOT_TOKEN,
  adminToken: config.GUARD_ADMIN_TOKEN,
})

const { SIGN_PAGE_URL, SQUADS_MULTISIG, SOLANA_HOT_WALLET_PUBKEY } = config
// loadConfig refuses SIGN_PAGE_URL without both keys, so this is undefined only when it is unset.
const phantomKill =
  SIGN_PAGE_URL && SQUADS_MULTISIG && SOLANA_HOT_WALLET_PUBKEY
    ? phantomKillUrl({
        signPage: SIGN_PAGE_URL,
        chain: config.SOLANA_CHAIN,
        multisig: SQUADS_MULTISIG,
        hot: SOLANA_HOT_WALLET_PUBKEY,
      })
    : undefined

const { bot, desk, commands } = createBot({
  token: config.TELEGRAM_BOT_TOKEN,
  owners: config.OWNER_TELEGRAM_IDS,
  guard,
  notifyAbove: config.NOTIFY_ABOVE_AMOUNT,
  log,
  phantomKill,
})

const server = await buildServer({
  secret: config.BOT_WEBHOOK_SECRET,
  handlers: {
    approvalRequest: (request) => desk.post(request),
    intentEvent: (event) => desk.event(event),
  },
  logger: log,
  rateLimitPerMinute: config.HOOK_RATE_LIMIT_PER_MINUTE,
})

const sweep = setInterval(() => {
  Promise.all([desk.expire(), desk.flushAlerts(), commands.expireKillOffers()]).catch(
    (err: unknown) => log.error({ err }, 'sweep failed'),
  )
}, EXPIRY_SWEEP_MS)

await server.listen({ port: config.PORT, host: config.HOST })

async function shutdown() {
  clearInterval(sweep)
  await bot.stop()
  await server.close()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

// Long polling: the bot needs no public URL, only guard-core needs to reach the hooks.
await bot.start({ allowed_updates: ['message', 'callback_query'] })
