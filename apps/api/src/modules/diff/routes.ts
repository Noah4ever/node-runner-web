import type { FastifyPluginAsync } from 'fastify'
import { diffRequestSchema } from '@node-runner/schemas'
import type { DiffResult } from '@node-runner/shared'
import { ok, fail } from '../../lib/response.js'

export const diffRoutes: FastifyPluginAsync = async (app) => {
    app.post('/diff', async (request, reply) => {
        const parsed = diffRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        // TODO: Implement real diff by parsing both inputs into NodeTree
        // and comparing nodes, links, and properties
        const result: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            linksAdded: [],
            linksRemoved: [],
            changes: [],
            summary: 'Diff not yet implemented. Trees received successfully.',
        }

        return ok(reply, result)
    })
}
