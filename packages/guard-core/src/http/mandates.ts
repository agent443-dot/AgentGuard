import type { FastifyReply } from 'fastify'
import type { Opened } from '../service/mandates.js'

/** A mandate outside the policy is refused with the same codes a payment would get. */
export function mandateReply(reply: FastifyReply, opened: Opened) {
  if ('notFound' in opened) {
    return reply.code(404).send({ error: 'not_found' })
  }
  if ('refused' in opened) {
    return reply.code(422).send({ error: 'outside_policy', rejectReasons: opened.refused })
  }
  return opened.mandate
}
