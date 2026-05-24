import type { FastifyPluginAsync } from 'fastify'
import { ok, fail } from '../../lib/response.js'
import { fetchSocketNames, PythonConverterError, type SocketNames } from '../../lib/pythonConverter.js'

// Cache the socket-name tables in memory. They only change when the upstream
// node_runner package updates, which the python loader already refreshes daily.
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour
let cached: { data: SocketNames; expiresAt: number } | null = null

export const nodeTypesRoutes: FastifyPluginAsync = async (app) => {
    app.get('/node-types/sockets', async (_request, reply) => {
        const now = Date.now()
        if (cached && cached.expiresAt > now) {
            reply.header('Cache-Control', 'public, max-age=3600')
            return ok(reply, cached.data)
        }
        try {
            const data = await fetchSocketNames()
            cached = { data, expiresAt: now + CACHE_TTL_MS }
            reply.header('Cache-Control', 'public, max-age=3600')
            return ok(reply, data)
        } catch (err) {
            if (err instanceof PythonConverterError) {
                app.log.warn({ err: err.message, stderr: err.stderr }, 'sockets_cli failed')
                return fail(reply, 'PYTHON_UNAVAILABLE', err.message, 503)
            }
            throw err
        }
    })
}
