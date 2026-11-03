import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { checkEnvs } from './env-check.js'

const root = new URL('../../packages/', import.meta.url)

function read(pkg: string): NodeJS.Dict<string> {
  const file = new URL(`${pkg}/.env`, root)
  try {
    return parseEnv(readFileSync(file, 'utf8'))
  } catch {
    console.error(`missing packages/${pkg}/.env: copy packages/${pkg}/.env.example and fill it in`)
    process.exit(1)
  }
}

const { errors, warnings } = checkEnvs({
  guard: read('guard-core'),
  bot: read('telegram-bot'),
  mcp: read('mcp-server'),
})

for (const warning of warnings) {
  console.warn(`warning: ${warning}`)
}
for (const error of errors) {
  console.error(`error: ${error}`)
}
if (errors.length > 0) {
  process.exit(1)
}
