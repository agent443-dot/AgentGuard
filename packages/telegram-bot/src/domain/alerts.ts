import type { PayIntent } from '@agentguard/shared'
import { attackCodesIn } from './codes.js'
import { attackText, executedText } from './text.js'

/** Messages an intent event is worth. Most events are worth none: the owner reads every one. */
export function alertsFor(intent: PayIntent, notifyAbove: bigint): string[] {
  const alerts: string[] = []
  if (intent.status === 'executed' && BigInt(intent.amount) >= notifyAbove) {
    alerts.push(executedText(intent))
  }
  const attacks = attackCodesIn(intent.rejectReasons)
  if (attacks.length > 0) {
    alerts.push(attackText(intent, attacks))
  }
  return alerts
}
