/**
 * The rate-limit key for a socket address. One IPv6 client usually holds a whole /64, so keying by
 * the full address would let it rotate through 2^64 keys; the /64 is what it actually controls.
 * IPv4, including IPv4-mapped IPv6, keys by the address itself.
 */
export function clientKey(address: string | undefined): string {
  if (address === undefined || address === '') {
    return 'unknown'
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped?.[1] !== undefined) {
    return mapped[1]
  }
  if (!address.includes(':')) {
    return address
  }
  const groups = expand(address.split('%')[0] ?? '')
  return groups === undefined ? address : `${groups.slice(0, 4).join(':')}::/64`
}

function expand(address: string): string[] | undefined {
  const halves = address.split('::')
  if (halves.length > 2) {
    return undefined
  }
  const head = halves[0] === '' ? [] : (halves[0]?.split(':') ?? [])
  const tail = halves.length === 2 && halves[1] !== '' ? (halves[1]?.split(':') ?? []) : []
  const missing = 8 - head.length - tail.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return undefined
  }
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail]
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) {
    return undefined
  }
  return groups.map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''))
}
