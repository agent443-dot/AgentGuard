import type { ApprovalRequest, BudgetView, OwnerTransaction, PayIntent } from '@agentguard/shared'
import { CHAINS, getAddress, usdSymbol } from '@agentguard/shared'
import { ATTACK_DESCRIPTIONS, type AttackCode } from './codes.js'
import { type ExplorerTarget, explorerUrl } from './explorer.js'
import { formatUsd } from './money.js'

/**
 * Every message the owner reads, as Telegram HTML. Anything that came from an agent or a counterparty
 * goes through escapeHtml: an agent that can inject markup can make its reason look like our text.
 */

export type Outcome =
  | { kind: 'approved' | 'rejected'; by: string; at: Date }
  | { kind: 'expired' | 'already_decided' | 'not_found' }

/** A null payload means guard-core could not build it: that chain's allowance is still live. */
export function isBuilt(tx: OwnerTransaction): boolean {
  return tx.payload !== null
}

const CHAIN_NAMES = new Map<string, string>([
  [CHAINS.solanaMainnet, 'Solana'],
  [CHAINS.solanaDevnet, 'Solana devnet'],
  [CHAINS.base, 'Base'],
  [CHAINS.baseSepolia, 'Base Sepolia'],
  [CHAINS.robinhood, 'Robinhood Chain'],
  [CHAINS.robinhoodTestnet, 'Robinhood Chain testnet'],
])

// Telegram rejects messages over 4096 characters; the payload is the only part that can be that long.
const PAYLOAD_LIMIT = 3000

const NOT_BUILT =
  '<b>no owner transaction could be built. The allowance on this chain is still live.</b>'

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function chainName(chain: string): string {
  return CHAIN_NAMES.get(chain) ?? escapeHtml(chain)
}

export function shortAddress(address: string): string {
  return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Dollars only for the chain's dollar in shared/addresses.ts (USDC, or USDG on Robinhood Chain). Any
 * other token is shown in base units with its address: a token with 6 decimals, or one named USDC,
 * could otherwise pass for dollars.
 */
export function amountText(intent: PayIntent): string {
  const symbol = usdSymbol(intent.chain)
  if (symbol !== undefined && getAddress(intent.chain, 'usd') === intent.token) {
    return `<b>${formatUsd(intent.amount)}</b> ${symbol}`
  }
  const warning =
    symbol === undefined
      ? 'this chain has no verified dollar'
      : `not the ${symbol} of this chain: any token named USDC or USDG at another address is someone else's`
  return (
    `<b>${escapeHtml(intent.amount)}</b> base units of <code>${escapeHtml(intent.token)}</code> ` +
    `(${warning})`
  )
}

/** A link only when the chain has an explorer we know: never one pointing at another network. */
export function explorerLink(chain: string, target: ExplorerTarget, id: string): string {
  const url = explorerUrl(chain, target, id)
  return url === undefined ? '' : ` · <a href="${escapeHtml(url)}">explorer</a>`
}

export function utcTime(at: Date | string): string {
  return `${new Date(at).toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

export function approvalText(request: ApprovalRequest): string {
  return ['<b>Approval needed</b>', ...details(request, false)].join('\n')
}

export function settledText(request: ApprovalRequest, outcome: Outcome): string {
  return [outcomeLine(outcome), ...details(request, true)].join('\n')
}

/** For a message the bot no longer has the request for, e.g. after a restart. */
export function settledFallback(original: string, outcome: Outcome): string {
  return `${outcomeLine(outcome)}\n${escapeHtml(original)}`
}

function details({ intent, simulation, approveBefore }: ApprovalRequest, full: boolean): string[] {
  const recipient = full ? intent.recipient : shortAddress(intent.recipient)
  return [
    `Agent: <code>${escapeHtml(intent.agentId)}</code>`,
    `Amount: ${amountText(intent)}`,
    `Chain: ${chainName(intent.chain)}`,
    `Recipient: <code>${escapeHtml(recipient)}</code>` +
      explorerLink(intent.chain, 'address', intent.recipient),
    destination(intent),
    `Simulation: ${escapeHtml(simulation.summary)}`,
    `Expires: ${utcTime(approveBefore)}`,
    '',
    `agent says: <i>${escapeHtml(intent.reason) || '(nothing)'}</i>`,
  ]
}

function destination(intent: PayIntent): string {
  return intent.kind === 'x402'
    ? `Domain: ${escapeHtml(intent.domain ?? '(none)')}`
    : 'Domain: none, direct transfer'
}

function outcomeLine(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'approved':
      return `<b>Approved</b> by ${escapeHtml(outcome.by)} at ${utcTime(outcome.at)}`
    case 'rejected':
      return `<b>Rejected</b> by ${escapeHtml(outcome.by)} at ${utcTime(outcome.at)}`
    case 'expired':
      return '<b>Expired</b>: not answered in time. Nothing was paid.'
    case 'already_decided':
      return '<b>Already decided</b>: this intent was settled before your answer arrived.'
    case 'not_found':
      return '<b>Unknown intent</b>: guard-core has no record of it. Nothing was paid.'
  }
}

export function executedText(intent: PayIntent): string {
  return [
    '<b>Payment executed</b>',
    `Agent: <code>${escapeHtml(intent.agentId)}</code>`,
    `Amount: ${amountText(intent)}`,
    `Chain: ${chainName(intent.chain)}`,
    `Recipient: <code>${escapeHtml(intent.recipient)}</code>` +
      explorerLink(intent.chain, 'address', intent.recipient),
    destination(intent),
    `Transaction: <code>${escapeHtml(intent.txId ?? '(not reported)')}</code>` +
      explorerLink(intent.chain, 'tx', intent.txId ?? ''),
  ].join('\n')
}

export function attackText(intent: PayIntent, codes: AttackCode[]): string {
  return [
    '<b>Possible attack blocked</b>',
    'guard-core refused a payment that tried to:',
    ...codes.map((code) => `• ${ATTACK_DESCRIPTIONS[code]} (<code>${code}</code>)`),
    '',
    `Agent: <code>${escapeHtml(intent.agentId)}</code>`,
    `Chain: ${intent.chain === '' ? '(not given)' : chainName(intent.chain)}`,
    `Recipient: <code>${escapeHtml(intent.recipient) || '(not given)'}</code>`,
    destination(intent),
    `agent says: <i>${escapeHtml(intent.reason) || '(nothing)'}</i>`,
    '',
    'No funds moved. The agent may be compromised or fed a malicious payment request: ' +
      'consider /pause.',
  ].join('\n')
}

export function heldBackText(
  agentId: string,
  code: AttackCode,
  repeats: number,
  since: number,
): string {
  const id = `<code>${escapeHtml(agentId)}</code>`
  return [
    `<b>Attack alerts held back</b>: ${repeats} more <code>${code}</code> ` +
      `${repeats === 1 ? 'rejection' : 'rejections'} for ${id} since ${utcTime(new Date(since))}.`,
    'All were blocked. Repeated attempts mean the agent is being driven: consider ' +
      `/pause ${id}.`,
  ].join('\n')
}

export function budgetText(agentId: string, budget: BudgetView): string {
  const wallets = Object.entries(budget.hotWalletBalances).map(
    ([chain, balance]) => `  ${chainName(chain)}: ${formatUsd(balance)}`,
  )
  return [
    `<b>Budget</b> for <code>${escapeHtml(agentId)}</code>`,
    `Spent today: ${formatUsd(budget.spentToday)} of ${formatUsd(budget.dailyMax)}`,
    `Per payment: up to ${formatUsd(budget.perTxMax)}`,
    'Hot wallets:',
    ...(wallets.length > 0 ? wallets : ['  (none reported)']),
    `Paused: ${budget.paused ? 'yes' : 'no'}`,
  ].join('\n')
}

export function statusText(guardUp: boolean, pending: ApprovalRequest[]): string {
  const lines = pending.map(
    ({ intent, approveBefore }) =>
      `• <code>${escapeHtml(intent.agentId)}</code> ${amountText(intent)} on ` +
      `${chainName(intent.chain)}, expires ${utcTime(approveBefore)}`,
  )
  return [
    `guard-core: ${guardUp ? 'reachable' : '<b>unreachable</b>'}`,
    `Pending approvals: ${pending.length}`,
    ...lines,
  ].join('\n')
}

export function killedText(pausedAgents: number, transactions: number, phantom = false): string {
  const next =
    transactions > 0
      ? `Sign the ${transactions === 1 ? 'transaction' : `${transactions} transactions`} below from ` +
        'the owner multisig to set each allowance to 0 and remove the delegate.'
      : '<b>No owner transaction is ready.</b> The onchain allowances are still live: ' +
        'remove them from the multisig directly.'
  const stopped =
    `<b>Kill switch engaged.</b> guard-core has paused ${pausedAgents} ` +
    `${pausedAgents === 1 ? 'agent' : 'agents'} and signs no more payments.`
  const onchain = phantom
    ? '<b>The Solana spending limit is still live onchain.</b> Tap <b>Open kill in Phantom</b> ' +
      'and confirm to remove it. The button expires in 15 minutes, or when another kill replaces it.'
    : next
  return [stopped, onchain].join('\n')
}

export function ownerTransactionText(tx: OwnerTransaction): string {
  const chain = `<b>${chainName(tx.chain)}</b>`
  if (tx.payload === null) {
    return `${chain}: ${NOT_BUILT}\n${escapeHtml(tx.description)}`
  }
  const payload = JSON.stringify(tx.payload, null, 2) ?? 'null'
  const shown =
    payload.length > PAYLOAD_LIMIT ? `${payload.slice(0, PAYLOAD_LIMIT)}\n… (truncated)` : payload
  return [`${chain}: ${escapeHtml(tx.description)}`, `<pre>${escapeHtml(shown)}</pre>`].join('\n')
}
