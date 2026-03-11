import type { FastifyReply } from 'fastify'
import type { ApiResponse } from '@node-runner/shared'

export function ok<T>(reply: FastifyReply, data: T, status = 200) {
    const body: ApiResponse<T> = { success: true, data }
    return reply.status(status).send(body)
}

export function fail(reply: FastifyReply, code: string, message: string, status = 400) {
    const body: ApiResponse<never> = { success: false, error: { code, message } }
    return reply.status(status).send(body)
}
