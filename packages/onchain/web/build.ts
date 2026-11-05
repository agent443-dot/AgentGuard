import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

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
  }
}

export function csp(rpc: Record<string, string>): string {
  const origins = [...new Set(Object.values(rpc).map((url) => new URL(url).origin))]
  return [
    "default-src 'none'",
    "script-src 'self'",
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
    // Some dependencies read process.env; a browser has no process.
    define: { RPC_URLS: JSON.stringify(rpc), 'process.env': '{}' },
    logLevel: 'warning',
  })
  const html = await readFile(here('./public/index.html'), 'utf8')
  await writeFile(`${outdir}/index.html`, html.replace('%CSP%', csp(rpc)))
  await copyFile(here('./public/style.css'), `${outdir}/style.css`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPage()
}
