import type { FastifyPluginAsync } from 'fastify'
import { inspectRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector, PlaceholderParser } from '@node-runner/core'
import type { NodeTreeMetadata } from '@node-runner/shared'
import { ok, fail } from '../../lib/response.js'

const detector = new DefaultFormatDetector()
const parser = new PlaceholderParser()

export const inspectRoutes: FastifyPluginAsync = async (app) => {
    app.post('/inspect', async (request, reply) => {
        const parsed = inspectRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const format = parsed.data.format ?? detector.detect(parsed.data.input).format
        const tree = parser.parse(parsed.data.input, format)
        const nodeNames = Object.keys(tree.nodes)

        const metadata: NodeTreeMetadata = {
            nodeCount: nodeNames.length,
            linkCount: tree.links.length,
            nodeTypes: [...new Set(nodeNames.map((n) => tree.nodes[n].type))],
            hasGroups: nodeNames.some((n) => tree.nodes[n].type === 'ShaderNodeGroup'),
            format,
            warnings: [],
        }

        return ok(reply, { tree, metadata, format })
    })
}
