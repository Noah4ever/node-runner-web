import type { FastifyPluginAsync } from 'fastify'
import { ok } from '../../lib/response.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get('/health', async (_request, reply) => {
        return ok(reply, {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '0.0.1',
        })
    })
}
