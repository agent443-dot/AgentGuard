const URL = /\w+:\/\/\S+/g

/**
 * RPC clients quote the endpoint in their errors, and a provider URL often carries the API key in
 * its path, where no client strips it. So no URL reaches a log line.
 */
export function redactUrls(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.replace(URL, '<url>')
  }
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUrls(item, depth + 1))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactUrls(item, depth + 1)]),
  )
}

/** The logger's `err`: what pino's own serializer keeps, without the URLs. */
export function serializeError(err: Error): {
  [key: string]: unknown
  type: string
  message: string
  stack: string
} {
  const cause = err.cause instanceof Error ? serializeError(err.cause) : redactUrls(err.cause)
  return {
    ...(redactUrls({ ...err }) as Record<string, unknown>),
    type: err.name,
    message: err.message.replace(URL, '<url>'),
    stack: (err.stack ?? '').replace(URL, '<url>'),
    ...(err.cause === undefined ? {} : { cause }),
  }
}
