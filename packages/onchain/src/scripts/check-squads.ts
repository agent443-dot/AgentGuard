import { readFile } from 'node:fs/promises'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { z } from 'zod'

/**
 * What the signing page and the adapter rely on in Squads v4 on a cluster, mainnet by default: the
 * program config the create page reads (the creation fee and the treasury it goes to), and whether
 * the deployed program is the binary our tests run (test/fixtures/squads_v4.so). Read-only, no key.
 *
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com pnpm check:squads
 */
const rpcUrl = z.url().parse(process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com')
const connection = new Connection(rpcUrl, 'confirmed')
const host = new URL(rpcUrl).host

const [configPda] = multisig.getProgramConfigPda({})
const config = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, configPda)
const fee = BigInt(config.multisigCreationFee.toString())
console.log(`program config ${configPda.toBase58()} at ${host}`)
console.log(`  creation fee: ${Number(fee) / LAMPORTS_PER_SOL} SOL (${fee} lamports)`)
console.log(`  treasury:     ${config.treasury.toBase58()}`)

// An upgradeable program points at its programdata account, whose bytes after a 45-byte header
// (kind, slot, authority) are the deployed ELF, zero-padded to the reserved length.
const program = await connection.getAccountInfo(multisig.PROGRAM_ID)
if (!program?.executable) {
  console.error(`no executable Squads program at ${multisig.PROGRAM_ID.toBase58()}`)
  process.exit(1)
}
const programData = new PublicKey(program.data.subarray(4, 36))
const deployed = (await connection.getAccountInfo(programData))!.data
const slot = deployed.readBigUInt64LE(4)
const fixture = await readFile(new URL('../../test/fixtures/squads_v4.so', import.meta.url))
const trim = (bytes: Buffer) => {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  return bytes.subarray(0, end)
}
const same = trim(deployed.subarray(45)).equals(trim(fixture))
console.log(`program ${multisig.PROGRAM_ID.toBase58()}, last deployed at slot ${slot}`)
console.log(`  ${same ? 'the same binary as' : 'NOT the binary in'} test/fixtures/squads_v4.so`)
process.exit(same ? 0 : 1)
