import type { FastifyPluginAsync } from 'fastify'
import { detectFormatRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector } from '@node-runner/core'
import { ok, fail } from '../../lib/response.js'

const detector = new DefaultFormatDetector()

export const parseRoutes: FastifyPluginAsync = async (app) => {
    app.post('/detect-format', async (request, reply) => {
        const parsed = detectFormatRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const result = detector.detect(parsed.data.input)
        return ok(reply, result)
    })
}
