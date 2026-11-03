import { readFileSync } from 'node:fs'
import { Keypair } from '@solana/web3.js'
import { z } from 'zod'

export const svmConfigSchema = z.object({
  SOLANA_CLUSTER: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  SOLANA_RPC_URL: z.url(),
  SOLANA_OWNER_KEYPAIR: z.string().min(1),
  SOLANA_HOT_WALLET_PUBKEY: z.string().min(32).max(44),
  SQUADS_MULTISIG: z.string().min(32).max(44).optional().or(z.literal('')),
  USDC_MINT: z.string().min(32).max(44).optional().or(z.literal('')),
  DAILY_CAP: z.string().regex(/^(0|[1-9]\d*)$/),
})

export type SvmConfig = z.infer<typeof svmConfigSchema>

export function loadSvmConfig(env: NodeJS.ProcessEnv = process.env): SvmConfig {
  const parsed = svmConfigSchema.safeParse(env)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`invalid solana configuration: ${fields}`)
  }
  return parsed.data
}

/** solana-keygen writes the 64-byte secret key as a JSON array of integers. */
const keypairFile = z.array(z.number().int().min(0).max(255)).length(64)

export function loadKeypair(path: string): Keypair {
  // A local file, and the zod schema below is exactly the validation the rule asks for.
  // eslint-disable-next-line no-restricted-properties
  const parsed = keypairFile.safeParse(JSON.parse(readFileSync(path, 'utf8')))
  if (!parsed.success) {
    // The path, never the contents: this is the one file that must not reach a log.
    throw new Error(`invalid keypair file: ${path}`)
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed.data))
}
