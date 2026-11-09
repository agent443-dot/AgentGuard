import { WizardError } from '../domain/errors.js'

export interface HttpResponse {
  status: number
  text: string
  /** The body as JSON, or undefined when it is not JSON; callers parse it with zod. */
  json: unknown
}

export interface Http {
  request(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    options?: { token?: string; body?: unknown },
  ): Promise<HttpResponse>
}

function parseJson(text: string): unknown {
  try {
    // Every caller validates this with a zod schema before reading it.
    // eslint-disable-next-line no-restricted-properties
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export const fetchHttp: Http = {
  async request(method, url, options = {}) {
    const headers: Record<string, string> = {}
    if (options.token !== undefined) {
      headers['authorization'] = `Bearer ${options.token}`
    }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
    }
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      // The URL is a public page or the local proxy; the token is in a header and never named.
      throw new WizardError('ADMIN_API', `could not reach ${new URL(url).origin}`)
    }
    const text = await response.text()
    return { status: response.status, text, json: parseJson(text) }
  },
}
