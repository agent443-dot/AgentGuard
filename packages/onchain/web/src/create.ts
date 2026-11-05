import { Keypair, type Connection, type PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { formatUnits } from '../../src/svm/transfer.js'
import { createMultisigInstruction, VAULT_INDEX } from '../../src/svm/squads.js'
import { decode, program, refused, type Plan } from './plan.js'

/**
 * A multisig controlled by the connected wallet, exactly as create-multisig makes it: the owner is
 * config authority and only member, threshold one, no time lock. Squads needs a one-time create key
 * to sign as well; the page makes it here and forgets it once the multisig exists.
 */
export async function prepareCreate(
  connection: Connection,
  cluster: string,
  owner: PublicKey,
): Promise<Plan> {
  const [configPda] = multisig.getProgramConfigPda({})
  const config = decode(await connection.getAccountInfo(configPda), multisig.accounts.ProgramConfig)
  if (!config) {
    return refused(`The Squads program config is missing on ${cluster}.`)
  }
  const createKey = Keypair.generate()
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey })
  const [vault] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX })
  const fee = BigInt(config.multisigCreationFee.toString())
  return {
    kind: 'sign',
    title: 'Create the multisig',
    instructions: [createMultisigInstruction(owner, createKey.publicKey, config.treasury)],
    coSigners: [createKey],
    after: 'Multisig created',
    summary: [
      `Create a Squads multisig at ${multisigPda.toBase58()}, on ${cluster}.`,
      `Config authority and only member: this wallet, ${owner.toBase58()}, with every ` +
        'permission. Threshold 1, no time lock.',
      `Its vault, where the USDC goes: ${vault.toBase58()}.`,
      `Squads' creation fee: ${formatUnits(fee, 9)} SOL, to its treasury ${config.treasury.toBase58()}.`,
      program(
        'multisigCreateV2',
        `this wallet and a one-time create key made by this page (${createKey.publicKey.toBase58()})`,
      ),
      "Phantom should show only SOL leaving your wallet: the account's rent and the fee above. " +
        'Reject anything else.',
    ],
    landed: async () => {
      const ms = decode(await connection.getAccountInfo(multisigPda), multisig.accounts.Multisig)
      if (!ms) {
        return undefined
      }
      const exact =
        ms.configAuthority.equals(owner) &&
        ms.threshold === 1 &&
        ms.members.length === 1 &&
        ms.members[0]!.key.equals(owner)
      if (!exact) {
        return [`The multisig at ${multisigPda.toBase58()} does not match what was signed.`]
      }
      return [
        `Multisig ${multisigPda.toBase58()} exists, controlled by ${owner.toBase58()} alone.`,
        `Vault: ${vault.toBase58()}. Set SQUADS_MULTISIG=${multisigPda.toBase58()} for guard-core.`,
        'Next: add the spending limit, from the link for that.',
      ]
    },
  }
}
