import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CHAINS, getAddress, usdSymbol, type ChainId } from '@agentguard/shared'
import { build } from 'esbuild'
import { isAddress } from 'viem'
import { isPublicKey } from './src/plan.js'

/**
 * The owner's signing page, as static files in web/dist. Everything the page runs is bundled here
 * from the lockfile's pinned versions: nothing is fetched at runtime but the RPC, and the CSP allows
 * nothing else.
 *
 * The RPC endpoints are fixed at build time, never taken from the link, so a link cannot point the
 * page at a node that lies about the chain.
 */
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export function rpcUrls(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return {
    devnet: env['SOLANA_DEVNET_RPC'] ?? 'https://api.devnet.solana.com',
    'mainnet-beta': env['SOLANA_MAINNET_RPC'] ?? 'https://api.mainnet-beta.solana.com',
    ...(env['SOLANA_LOCALNET_RPC'] ? { localnet: env['SOLANA_LOCALNET_RPC'] } : {}),
    'robinhood-testnet': env['ROBINHOOD_TESTNET_RPC'] ?? 'https://rpc.testnet.chain.robinhood.com',
    robinhood: env['ROBINHOOD_MAINNET_RPC'] ?? 'https://rpc.mainnet.chain.robinhood.com',
    ...(env['EVM_LOCALNET_RPC'] ? { 'evm-localnet': env['EVM_LOCALNET_RPC'] } : {}),
  }
}

/**
 * The EVM clusters: the chain id Phantom must be on, the module and token from the verified
 * addresses in shared, and the hot wallet whose delegate entry the kill removes. A link names the
 * cluster and the Safe only. The tests' evm-localnet stands in for Robinhood testnet, with its id
 * and addresses.
 */
export function evmChains(env: NodeJS.ProcessEnv = process.env) {
  const chain = (id: ChainId, hotVar: string) => {
    const hot = env[hotVar]
    if (hot && !isAddress(hot)) {
      throw new Error(`${hotVar} is not an EVM address: ${hot}`)
    }
    return {
      chainId: Number(id.split(':')[1]),
      module: getAddress(id, 'allowanceModule')!,
      usd: getAddress(id, 'usd')!,
      symbol: usdSymbol(id)!,
      ...(hot ? { hot } : {}),
    }
  }
  return {
    'robinhood-testnet': chain(CHAINS.robinhoodTestnet, 'ROBINHOOD_HOT_WALLET_TESTNET'),
    robinhood: chain(CHAINS.robinhood, 'ROBINHOOD_HOT_WALLET_MAINNET'),
    ...(env['EVM_LOCALNET_RPC']
      ? { 'evm-localnet': chain(CHAINS.robinhoodTestnet, 'EVM_HOT_WALLET_LOCALNET') }
      : {}),
  }
}

/** USDC for each cluster, from the verified addresses in shared, so no link can name another mint. */
export function usdcMints(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const known = {
    devnet: getAddress(CHAINS.solanaDevnet, 'usd'),
    'mainnet-beta': getAddress(CHAINS.solanaMainnet, 'usd'),
    localnet: env['SOLANA_LOCALNET_USDC'],
  }
  return Object.fromEntries(
    Object.entries(known).filter(([, mint]) => mint !== undefined),
  ) as Record<string, string>
}

/**
 * The hot wallet each cluster's limit is for. The add-limit page grants exactly this key the right to
 * draw, so it is fixed here, where only a deploy from protected main can change it, and never read
 * from a link: a crafted link could otherwise name an attacker's key.
 */
export function hotWallets(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const known = {
    devnet: env['SOLANA_HOT_WALLET_DEVNET'],
    'mainnet-beta': env['SOLANA_HOT_WALLET_MAINNET'],
    localnet: env['SOLANA_HOT_WALLET_LOCALNET'],
  }
  const set = Object.entries(known).filter((entry): entry is [string, string] => Boolean(entry[1]))
  for (const [cluster, key] of set) {
    // A typo fails the deploy here rather than the owner's page later.
    if (!isPublicKey(key)) {
      throw new Error(`the hot wallet for ${cluster} is not a Solana public key: ${key}`)
    }
  }
  return Object.fromEntries(set)
}

/** The largest daily cap a link may ask for, in USDC base units. D1 sets 50 USDC. */
export function maxDailyCap(env: NodeJS.ProcessEnv = process.env): string {
  const max = env['MAX_DAILY_CAP'] ?? '50000000'
  if (!/^[1-9]\d*$/.test(max)) {
    throw new Error(`MAX_DAILY_CAP must be a positive whole number of base units, not ${max}`)
  }
  return max
}

export function csp(rpc: Record<string, string>): string {
  const origins = [...new Set(Object.values(rpc).map((url) => new URL(url).origin))]
  return [
    "default-src 'none'",
    // 'unsafe-eval' is for Phantom, not for us: its provider runs in this page's world and compiles
    // zod schemas with new Function, so without it connect fails (ADR 003). Scripts still load
    // from this origin only, and the page has no string-to-code sink of its own.
    "script-src 'self' 'unsafe-eval'",
    "style-src 'self'",
    `connect-src ${origins.join(' ')}`,
    "img-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

export async function buildPage(outdir = here('./dist'), env = process.env) {
  const rpc = rpcUrls(env)
  await mkdir(outdir, { recursive: true })
  await build({
    entryPoints: [here('./src/main.ts')],
    outfile: `${outdir}/app.js`,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    define: {
      RPC_URLS: JSON.stringify(rpc),
      USDC_MINTS: JSON.stringify(usdcMints(env)),
      HOT_WALLETS: JSON.stringify(hotWallets(env)),
      MAX_DAILY_CAP: JSON.stringify(maxDailyCap(env)),
      EVM_CHAINS: JSON.stringify(evmChains(env)),
      // Some dependencies read process.env; a browser has no process.
      'process.env': '{}',
    },
    logLevel: 'warning',
  })
  const html = await readFile(here('./public/index.html'), 'utf8')
  await writeFile(`${outdir}/index.html`, html.replace('%CSP%', csp(rpc)))
  await copyFile(here('./public/style.css'), `${outdir}/style.css`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPage()
}
