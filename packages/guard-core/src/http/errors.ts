/** A refusal with a status code. The error handler sends `message` as the error and nothing else. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}
