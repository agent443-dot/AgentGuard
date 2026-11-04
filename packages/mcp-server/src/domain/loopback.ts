const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isLoopback(host: string): boolean {
  return LOOPBACK.has(host)
}

/** The hostname part of a Host header, keeping an IPv6 literal's brackets. */
export function hostOf(header: string | undefined): string {
  if (header === undefined) {
    return ''
  }
  return header.startsWith('[')
    ? header.slice(0, header.indexOf(']') + 1)
    : (header.split(':')[0] ?? '')
}
