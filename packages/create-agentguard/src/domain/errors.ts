export type WizardCode =
  | 'INVALID_INPUT'
  | 'PREREQUISITE'
  | 'COMMAND_FAILED'
  | 'KEY_EXISTS'
  | 'PAGE_MISMATCH'
  | 'VAULT_MISMATCH'
  | 'VAULT_TIMEOUT'
  | 'ADMIN_API'
  | 'NOT_SET_UP'

/** Its message is shown to the person as is, so it never carries a secret. */
export class WizardError extends Error {
  constructor(
    readonly code: WizardCode,
    message: string,
  ) {
    super(message)
    this.name = 'WizardError'
  }
}
