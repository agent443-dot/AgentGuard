import { InlineKeyboard } from 'grammy'

/**
 * Callback data is capped at 64 bytes by Telegram; an action plus a uuid fits. A passkey request has
 * no Approve callback at all: only the passkey page can approve it, so the bot offers a link there.
 */
export function approvalKeyboard(intentId: string, passkeyPage?: string | null): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  if (passkeyPage === undefined) {
    keyboard.text('Approve', `approve:${intentId}`)
  } else if (passkeyPage !== null) {
    keyboard.url('Approve with passkey', passkeyPage)
  }
  return keyboard
    .text('Reject', `reject:${intentId}`)
    .row()
    .text('Show full recipient', `recipient:${intentId}`)
}

export function mandateKeyboard(mandateId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Approve', `task-approve:${mandateId}`)
    .text('Reject', `task-reject:${mandateId}`)
}
