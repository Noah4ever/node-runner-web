import type { FastifyPluginAsync } from 'fastify'
import { convertRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector, PlaceholderConverter } from '@node-runner/core'
import { ok, fail } from '../../lib/response.js'

const detector = new DefaultFormatDetector()
const converter = new PlaceholderConverter()

export const convertRoutes: FastifyPluginAsync = async (app) => {
    app.post('/convert', async (request, reply) => {
        const parsed = convertRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const sourceFormat = parsed.data.sourceFormat ?? detector.detect(parsed.data.input).format
        const output = converter.convert(parsed.data.input, sourceFormat, parsed.data.targetFormat)

        return ok(reply, {
            output,
            sourceFormat,
            targetFormat: parsed.data.targetFormat,
        })
    })
}
