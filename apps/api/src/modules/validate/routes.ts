import type { FastifyPluginAsync } from 'fastify'
import { validateRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector, PlaceholderValidator } from '@node-runner/core'
import { ok, fail } from '../../lib/response.js'

const detector = new DefaultFormatDetector()
const validator = new PlaceholderValidator()

export const validateRoutes: FastifyPluginAsync = async (app) => {
    app.post('/validate', async (request, reply) => {
        const parsed = validateRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const format = parsed.data.format ?? detector.detect(parsed.data.input).format
        const result = validator.validate(parsed.data.input, format)

        return ok(reply, { ...result, format })
    })
}
