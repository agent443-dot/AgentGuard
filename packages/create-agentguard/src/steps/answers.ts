import {
  agentIdSchema,
  appNames,
  capSchema,
  check,
  defaultPrefix,
  familiesSchema,
  httpsUrlSchema,
  orgSchema,
  ownerIdsSchema,
  prefixSchema,
  presetSchema,
  regionSchema,
  telegramTokenSchema,
  yesNo,
  type Answers,
} from '../domain/answers.js'
import { formatEnvFile, parseEnvFile } from '../domain/env.js'
import { NETWORKS, networkFor, type NetworkId } from '../domain/networks.js'
import { SECRETS, type Paths } from '../domain/plan.js'
import { prefixesIn } from '../domain/state.js'
import type { Ctx } from './context.js'

export async function choosePrefix(ctx: Ctx): Promise<string> {
  const existing = prefixesIn(await ctx.files.list(`${ctx.home}/.agentguard`))
  return ctx.prompt.ask({
    text: 'A short name for your Fly apps. They become <name>-guard-core and <name>-bot, and Fly names are global, so make it your own.',
    default: existing.length === 1 ? existing[0] : defaultPrefix(ctx.username),
    parse: (raw) => check(prefixSchema, raw),
  })
}

export async function askAnswers(ctx: Ctx, prefix: string): Promise<Answers> {
  const ask = ctx.prompt.ask.bind(ctx.prompt)
  const org = await ask({
    text: 'Your Fly organization (`fly orgs list` shows yours).',
    default: 'personal',
    parse: (raw) => check(orgSchema, raw),
  })
  const region = await ask({
    text: 'The Fly region for both apps.',
    default: 'gru',
    parse: (raw) => check(regionSchema, raw),
  })
  const families = await ask({
    text: 'Which chains: solana, robinhood or both?',
    default: 'both',
    parse: (raw) => check(familiesSchema, raw),
  })
  const testnet = await ask({
    text: 'Advanced: use the test networks (Solana devnet, Robinhood Chain testnet) instead of mainnet?',
    default: 'no',
    parse: (raw) => yesNo(raw, false),
  })
  const networks = families.map((family) => networkFor(family, testnet))
  const caps: Partial<Record<NetworkId, string>> = {}
  for (const network of networks) {
    const { label, usd } = NETWORKS[network]
    caps[network] = await ask({
      text: `The daily cap on ${label}, in ${usd}. The chain itself enforces it, at most 50.`,
      default: '20',
      parse: (raw) => check(capSchema, raw),
    })
  }
  const preset = await ask({
    text: 'The policy for your first agent: careful (at most 1 per payment and 5 a day, your approval from 0.50) or standard (5 per payment, 20 a day, your approval from 1)?',
    default: 'careful',
    parse: (raw) => check(presetSchema, raw.toLowerCase()),
  })
  const ownerIds = await ask({
    text: 'Your Telegram user id: only this account can approve payments and press kill. @userinfobot tells you yours. For several, separate them with commas.',
    parse: (raw) => check(ownerIdsSchema, raw),
  })
  const agentId = await ask({
    text: 'A name for your first agent.',
    default: 'agent-1',
    parse: (raw) => check(agentIdSchema, raw),
  })
  return { prefix, org, region, networks, caps, preset, ownerIds, agentId }
}

/**
 * Fills the env file with what is still missing: the bot token and the RPC URLs, asked, and the
 * three service tokens, generated. Nothing here is printed.
 */
export async function secrets(ctx: Ctx, paths: Paths, answers: Answers): Promise<void> {
  if (ctx.dry) {
    ctx.say('(dry run: the Telegram token and the RPC URLs are not asked)')
    await ctx.files.write(paths.envFile, '')
    return
  }
  const entries = (await ctx.files.exists(paths.envFile))
    ? parseEnvFile(await ctx.files.read(paths.envFile))
    : {}
  const missing = (name: string) => entries[name] === undefined || entries[name] === ''
  for (const name of [SECRETS.admin, SECRETS.bot, SECRETS.webhook]) {
    if (missing(name)) {
      entries[name] = ctx.token()
    }
  }
  for (const { name, ask } of questions(answers)) {
    if (missing(name)) {
      entries[name] = await ctx.prompt.ask(ask)
    }
  }
  await ctx.files.write(paths.envFile, formatEnvFile(entries))
}

function questions(answers: Answers) {
  const solana = answers.networks.find((network) => NETWORKS[network].family === 'solana')
  const robinhood = answers.networks.find((network) => NETWORKS[network].family === 'robinhood')
  const url = (raw: string) => check(httpsUrlSchema, raw)
  const page = `https://${appNames(answers.prefix).page}.vercel.app`
  return [
    {
      name: SECRETS.telegram,
      ask: {
        text: 'Your Telegram bot token, from @BotFather. It is hidden as you type.',
        hidden: true,
        parse: (raw: string) => check(telegramTokenSchema, raw),
      },
    },
    ...(solana === undefined
      ? []
      : [
          {
            name: SECRETS.solanaRpc,
            ask: {
              text: `The Solana RPC URL guard-core uses. Use a private one (Helius, QuickNode and others): it stays in your Fly secrets.`,
              default: NETWORKS[solana].publicRpc,
              parse: url,
            },
          },
          {
            name: SECRETS.pageRpc,
            ask: {
              text: `The Solana RPC URL for your signing page. Its key is public inside the page, so make a second key locked to the page's domain (${page}, or the one Vercel gives it): then no one else can spend its quota.`,
              default: NETWORKS[solana].publicRpc,
              parse: url,
            },
          },
        ]),
    ...(robinhood === undefined
      ? []
      : [
          {
            name: SECRETS.robinhoodRpc,
            ask: {
              text: 'The Robinhood Chain RPC URL guard-core uses.',
              default: NETWORKS[robinhood].publicRpc,
              parse: url,
            },
          },
        ]),
  ]
}
