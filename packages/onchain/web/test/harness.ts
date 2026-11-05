import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Keypair, LAMPORTS_PER_SOL, TransactionMessage } from '@solana/web3.js'
import type { TransactionInstruction, VersionedTransaction } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import type { Browser, Page } from 'playwright'
import { chain, plantProgramConfig } from '../../test/fixture.js'
import { buildPage } from '../build.js'
import { mockPhantom, servePage } from './server.js'

const squads = fileURLToPath(new URL('../../test/fixtures/squads_v4.so', import.meta.url))

/**
 * A chain with the real Squads program and its config, an owner with SOL, and the page built for a
 * local server whose stand-in Phantom signs with whichever key `connected` names.
 */
export async function stage() {
  const c = chain()
  c.svm.addProgramFromFile(multisig.PROGRAM_ID, squads)
  plantProgramConfig(c)
  const owner = Keypair.generate()
  c.svm.airdrop(owner.publicKey, BigInt(10 * LAMPORTS_PER_SOL))
  const wallet = { connected: owner }
  const server = await servePage(
    c.svm,
    await mkdtemp(join(tmpdir(), 'agentguard-sign-')),
    () => wallet.connected,
  )
  // The server's port is only known once it listens, so the page is built for it afterwards.
  await buildPage(server.dist, {
    SOLANA_LOCALNET_RPC: `${server.origin}/rpc`,
    SOLANA_LOCALNET_USDC: c.mint.toBase58(),
  })

  async function open(
    browser: Browser,
    query: Record<string, string>,
    { phantom = true, rejects = false } = {},
  ): Promise<Page> {
    const page = await browser.newPage()
    if (phantom) {
      await page.addInitScript(mockPhantom(wallet.connected.publicKey.toBase58(), rejects))
    }
    await page.goto(`${server.origin}/?${new URLSearchParams({ cluster: 'localnet', ...query })}`)
    return page
  }
  return { c, owner, wallet, server, open }
}

export const heading = (page: Page) => page.locator('h1')
export const lines = (page: Page) => page.locator('p').allTextContents()

/**
 * What identifies an instruction: its program, data and accounts in order. Decompiling marks the fee
 * payer a signer wherever it appears, so the flags are left out.
 */
export const shape = (ix: TransactionInstruction) => ({
  programId: ix.programId.toBase58(),
  data: ix.data.toString('hex'),
  keys: ix.keys.map((key) => key.pubkey.toBase58()),
})

export const sentInstructions = (tx: VersionedTransaction) =>
  TransactionMessage.decompile(tx.message).instructions.map(shape)
