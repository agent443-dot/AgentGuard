// Control and bidi-override characters could fake line breaks or reorder text in the model's view.
const UNPRINTABLE = /[\p{Cc}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu

/** guard-core's echo of agent-supplied values is still shown bounded, never in full. */
export function listOf(values: readonly string[], max = 10): string {
  const shown = values.slice(0, max).map((value) => value.replace(UNPRINTABLE, '').slice(0, 253))
  const more = values.length > max ? ` and ${values.length - max} more` : ''
  return shown.length === 0 ? 'no websites' : `${shown.join(', ')}${more}`
}
