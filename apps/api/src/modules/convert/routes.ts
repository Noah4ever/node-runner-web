import type { FastifyPluginAsync } from 'fastify'
import { convertRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector } from '@node-runner/core'
import { ok, fail } from '../../lib/response.js'
import { pythonConvert, PythonConverterError, type NodeFormat } from '../../lib/pythonConverter.js'

const detector = new DefaultFormatDetector()

export const convertRoutes: FastifyPluginAsync = async (app) => {
    app.post('/convert', async (request, reply) => {
        const parsed = convertRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const sourceFormat = (parsed.data.sourceFormat ?? detector.detect(parsed.data.input).format) as NodeFormat
        const targetFormat = parsed.data.targetFormat as NodeFormat

        try {
            const result = await pythonConvert(parsed.data.input, sourceFormat, targetFormat)
            return ok(reply, result)
        } catch (err) {
            if (err instanceof PythonConverterError) {
                app.log.warn({ err: err.message, stderr: err.stderr }, 'python converter failed')
                return fail(reply, 'CONVERT_FAILED', err.message, 502)
            }
            throw err
        }
    })
}
