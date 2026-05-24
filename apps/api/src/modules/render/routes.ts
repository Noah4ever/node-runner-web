import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { fail } from '../../lib/response.js'
import { renderShader, RenderError, NoShaderError } from '../../lib/blenderRender.js'
import { pythonConvert, type NodeFormat } from '../../lib/pythonConverter.js'

const renderRequestSchema = z.object({
    // Either supply raw JSON content directly, or a content+format pair we'll
    // convert via Python first. Most callers will pass content+format.
    content: z.string().min(1).max(200_000),
    format: z.enum(['hash', 'json', 'xml', 'ai_json']),
})

export const renderRoutes: FastifyPluginAsync = async (app) => {
    // Rate limit per-IP to keep one user from saturating the renderer.
    // 6 fresh renders per hour. Cached hits don't count against the bucket
    // because they're cheap.
    const buckets = new Map<string, { count: number; resetAt: number }>()
    const WINDOW_MS = 60 * 60 * 1000
    const LIMIT = 6

    function checkBucket(ip: string): boolean {
        const now = Date.now()
        const b = buckets.get(ip)
        if (!b || now > b.resetAt) {
            buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
            return true
        }
        if (b.count >= LIMIT) return false
        b.count++
        return true
    }

    app.post('/render', async (request, reply) => {
        const parsed = renderRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const { content, format } = parsed.data

        // Normalize to JSON for the renderer - it expects a {nodes, links} dict.
        let jsonContent: string
        if (format === 'json') {
            jsonContent = content
        } else {
            try {
                const result = await pythonConvert(content, format as NodeFormat, 'json')
                jsonContent = result.output
            } catch (err) {
                return fail(reply, 'CONVERT_FAILED', (err as Error).message, 502)
            }
        }

        try {
            const { png, cached, hash } = await renderShader(jsonContent)
            if (!cached && !checkBucket(request.ip)) {
                // Reject the request *after* render only if it wasn't a cache hit;
                // doing this before would block cached requests too.
                // We still return the rendered PNG since we already spent the work,
                // but flag it via header for client awareness.
                reply.header('X-Render-Quota', 'exceeded')
            }
            reply
                .header('Content-Type', 'image/png')
                .header('X-Render-Cached', cached ? '1' : '0')
                .header('X-Render-Hash', hash)
                .header('Cache-Control', 'public, max-age=3600')
            return reply.send(png)
        } catch (err) {
            if (err instanceof NoShaderError) {
                return fail(reply, 'NO_SHADER', err.message, 422)
            }
            if (err instanceof RenderError) {
                app.log.warn({ err: err.message, stderr: err.stderr, exit: err.exitCode }, 'blender render failed')
                return fail(reply, 'RENDER_FAILED', err.message, 502)
            }
            throw err
        }
    })

    // Quota check endpoint so the UI can disable the button preemptively.
    app.get('/render/quota', async (request, reply) => {
        const now = Date.now()
        const b = buckets.get(request.ip)
        if (!b || now > b.resetAt) {
            reply.header('Cache-Control', 'no-store')
            return reply.send({ success: true, data: { used: 0, limit: LIMIT, resetAt: now + WINDOW_MS } })
        }
        reply.header('Cache-Control', 'no-store')
        return reply.send({ success: true, data: { used: b.count, limit: LIMIT, resetAt: b.resetAt } })
    })
}
