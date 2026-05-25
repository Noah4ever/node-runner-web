import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { fail } from '../../lib/response.js'
import { renderShader, RenderError, NoShaderError, type RenderShape } from '../../lib/blenderRender.js'
import { pythonConvert, type NodeFormat } from '../../lib/pythonConverter.js'
import { getUserFromRequest } from '../auth/routes.js'

const renderRequestSchema = z.object({
    // Either supply raw JSON content directly, or a content+format pair we'll
    // convert via Python first. Most callers will pass content+format.
    content: z.string().min(1).max(200_000),
    format: z.enum(['hash', 'json', 'xml', 'ai_json']),
    shape: z.enum(['sphere', 'cube', 'plane', 'cylinder', 'torus', 'monkey']).optional(),
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

        const { content, format, shape } = parsed.data
        const user = getUserFromRequest(request)
        const isAdmin = !!user?.isAdmin
        const renderShape: RenderShape = (shape ?? 'sphere') as RenderShape

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
            const { png, cached, hash } = await renderShader(jsonContent, renderShape)
            // Admins bypass the quota entirely; others get budgeted, cache
            // hits always free. Charge happens AFTER the render so we don't
            // accept a quota miss only to then fail on render.
            if (!cached && !isAdmin) {
                if (!checkBucket(request.ip)) {
                    reply.header('X-Render-Quota', 'exceeded')
                }
            }
            reply
                .header('Content-Type', 'image/png')
                .header('X-Render-Cached', cached ? '1' : '0')
                .header('X-Render-Hash', hash)
                .header('X-Render-Admin', isAdmin ? '1' : '0')
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

    // Quota check so the UI can show used/limit + reset time. Admins get a
    // sentinel `unlimited: true` instead of a numeric budget.
    app.get('/render/quota', async (request, reply) => {
        reply.header('Cache-Control', 'no-store')
        const user = getUserFromRequest(request)
        if (user?.isAdmin) {
            return reply.send({ success: true, data: { unlimited: true, used: 0, limit: 0, resetAt: 0 } })
        }
        const now = Date.now()
        const b = buckets.get(request.ip)
        if (!b || now > b.resetAt) {
            return reply.send({ success: true, data: { unlimited: false, used: 0, limit: LIMIT, resetAt: now + WINDOW_MS } })
        }
        return reply.send({ success: true, data: { unlimited: false, used: b.count, limit: LIMIT, resetAt: b.resetAt } })
    })
}
