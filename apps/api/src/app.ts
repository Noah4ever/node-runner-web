import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './lib/env.js'
import { healthRoutes } from './modules/health/routes.js'
import { parseRoutes } from './modules/parse/routes.js'
import { validateRoutes } from './modules/validate/routes.js'
import { convertRoutes } from './modules/convert/routes.js'
import { inspectRoutes } from './modules/inspect/routes.js'
import { shareRoutes } from './modules/share/routes.js'
import { diffRoutes } from './modules/diff/routes.js'
import { authRoutes } from './modules/auth/routes.js'

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            ...(env.NODE_ENV === 'development' && {
                transport: { target: 'pino-pretty' },
            }),
        },
        bodyLimit: 14_000_000, // 14 MB max request body (supports up to 4 base64 image uploads)
    })

    // Plugins
    await app.register(cors, { origin: env.FRONTEND_URL, credentials: true })

    await app.register(rateLimit, {
        max: 60,
        timeWindow: '1 minute',
    })

    // Security headers
    app.addHook('onSend', (_request, reply, payload, done) => {
        reply.header('X-Content-Type-Options', 'nosniff')
        reply.header('X-Frame-Options', 'DENY')
        reply.header('X-XSS-Protection', '0')
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
        if (env.NODE_ENV === 'production') {
            reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        }
        done(null, payload)
    })

    // Error handler
    app.setErrorHandler((error: { statusCode?: number; message?: string }, _request, reply) => {
        app.log.error(error)

        if (error.statusCode === 429) {
            return reply.status(429).send({
                success: false,
                error: { code: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
            })
        }

        if (error.statusCode === 413 || (error.message && error.message.includes('body'))) {
            return reply.status(413).send({
                success: false,
                error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large. Try using a smaller image (under 2 MB).' },
            })
        }

        const statusCode = error.statusCode ?? 500
        reply.status(statusCode).send({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: env.NODE_ENV === 'production' ? 'Internal server error' : error.message ?? 'Unknown error',
            },
        })
    })

    // Routes
    await app.register(healthRoutes, { prefix: '/api/v1' })
    await app.register(parseRoutes, { prefix: '/api/v1/parse' })
    await app.register(validateRoutes, { prefix: '/api/v1' })
    await app.register(convertRoutes, { prefix: '/api/v1' })
    await app.register(inspectRoutes, { prefix: '/api/v1' })
    await app.register(shareRoutes, { prefix: '/api/v1' })
    await app.register(diffRoutes, { prefix: '/api/v1' })
    await app.register(authRoutes, { prefix: '/api/v1/auth' })

    return app
}
