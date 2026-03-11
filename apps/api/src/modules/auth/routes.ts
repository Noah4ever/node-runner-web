import type { FastifyPluginAsync } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { ok, fail } from '../../lib/response.js'
import { env } from '../../lib/env.js'
import { PersistedMap, PersistedSet } from '../../lib/persist.js'

const sessions = new PersistedMap<{ userId: string; email: string; name: string | null; avatarUrl: string | null; provider: string; isAdmin?: boolean }>('sessions')
const users = new PersistedMap<{ id: string; email: string; name: string | null; avatarUrl: string | null; provider: string; providerId: string; createdAt: string }>('users')
const bannedUsers = new PersistedSet('banned-users')

// OAuth state tokens (ephemeral — no need to persist)
const oauthStates = new Map<string, { provider: string; createdAt: number }>()

function generateSessionToken(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function generateId(): string {
    return crypto.randomUUID()
}

function findOrCreateUser(provider: string, providerId: string, email: string, name: string | null, avatarUrl: string | null) {
    const lookupKey = `${provider}:${providerId}`
    let user = users.get(lookupKey)
    if (!user) {
        user = {
            id: generateId(),
            email,
            name,
            avatarUrl,
            provider,
            providerId,
            createdAt: new Date().toISOString(),
        }
        users.set(lookupKey, user)
    } else {
        // Update name/avatar if changed
        const updated = { ...user }
        if (name && name !== user.name) updated.name = name
        if (avatarUrl && avatarUrl !== user.avatarUrl) updated.avatarUrl = avatarUrl
        if (updated !== user) users.set(lookupKey, updated)
        user = updated
    }
    return user
}

function createSession(user: { id: string; email: string; name: string | null; avatarUrl: string | null; provider: string }, isAdmin = false) {
    const token = generateSessionToken()
    sessions.set(token, {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        isAdmin,
    })
    return token
}

export function getUserFromRequest(request: { headers: Record<string, string | string[] | undefined> }): { userId: string; email: string; name: string | null; avatarUrl: string | null; provider: string; isAdmin?: boolean } | null {
    const authHeader = request.headers.authorization
    if (!authHeader || typeof authHeader !== 'string') return null
    const token = authHeader.replace('Bearer ', '')
    return sessions.get(token) ?? null
}

export function isUserBanned(userId: string): boolean {
    return bannedUsers.has(userId)
}

export function banUser(userId: string): void {
    bannedUsers.add(userId)
    for (const [token, session] of sessions.entries()) {
        if (session.userId === userId) sessions.delete(token)
    }
}

export function unbanUser(userId: string): void {
    bannedUsers.delete(userId)
}

export function getUserById(userId: string): { id: string; name: string | null; avatarUrl: string | null; createdAt: string } | null {
    for (const user of users.values()) {
        if (user.id === userId) return { id: user.id, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt }
    }
    return null
}

export const authRoutes: FastifyPluginAsync = async (app) => {
    // Available auth providers
    app.get('/providers', async (_request, reply) => {
        const providers: string[] = ['device']
        if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google')
        if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push('github')
        return ok(reply, { providers })
    })

    // Get current user
    app.get('/me', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Not logged in', 401)
        }
        return ok(reply, user)
    })

    // Device login (username-only, no cross-device)
    app.post('/login', async (request, reply) => {
        const body = request.body as { provider?: string; email?: string; name?: string; avatarUrl?: string; providerId?: string }

        if (!body.provider || !body.email || !body.providerId) {
            return fail(reply, 'VALIDATION_ERROR', 'provider, email, and providerId are required')
        }

        const user = findOrCreateUser(body.provider, body.providerId, body.email, body.name ?? null, body.avatarUrl ?? null)

        if (bannedUsers.has(user.id)) {
            return fail(reply, 'FORBIDDEN', 'This account has been banned', 403)
        }

        const isAdmin = !!(env.ADMIN_EMAIL && env.ADMIN_PASSWORD && user.email === env.ADMIN_EMAIL)
        const token = createSession(user, isAdmin)

        return ok(reply, { token, user: { ...user, isAdmin } })
    })

    // ── Google OAuth ─────────────────────────────────────────────────
    app.get('/google', async (_request, reply) => {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
            return fail(reply, 'NOT_FOUND', 'Google login not configured', 404)
        }

        const state = generateSessionToken()
        oauthStates.set(state, { provider: 'google', createdAt: Date.now() })

        const redirectUri = `${env.FRONTEND_URL}/api/v1/auth/google/callback`
        const params = new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'select_account',
        })

        return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    })

    app.get('/google/callback', async (request, reply) => {
        const { code, state, error: oauthError } = request.query as { code?: string; state?: string; error?: string }

        if (oauthError || !code || !state) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=oauth_denied`)
        }

        const stored = oauthStates.get(state)
        oauthStates.delete(state)
        if (!stored || stored.provider !== 'google' || Date.now() - stored.createdAt > 600_000) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=invalid_state`)
        }

        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=not_configured`)
        }

        try {
            const redirectUri = `${env.FRONTEND_URL}/api/v1/auth/google/callback`

            // Exchange code for tokens
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: env.GOOGLE_CLIENT_ID,
                    client_secret: env.GOOGLE_CLIENT_SECRET,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                }),
            })

            if (!tokenRes.ok) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=token_exchange`)
            }

            const tokens = await tokenRes.json() as { access_token: string }

            // Get user info
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            })

            if (!userRes.ok) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=user_info`)
            }

            const profile = await userRes.json() as { id: string; email: string; name?: string; picture?: string }

            const user = findOrCreateUser('google', profile.id, profile.email, profile.name ?? null, profile.picture ?? null)

            if (bannedUsers.has(user.id)) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=banned`)
            }

            const isAdmin = !!(env.ADMIN_EMAIL && user.email === env.ADMIN_EMAIL)
            const sessionToken = createSession(user, isAdmin)

            return reply.redirect(`${env.FRONTEND_URL}/auth/callback?token=${sessionToken}`)
        } catch {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=oauth_failed`)
        }
    })

    // ── GitHub OAuth ─────────────────────────────────────────────────
    app.get('/github', async (_request, reply) => {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
            return fail(reply, 'NOT_FOUND', 'GitHub login not configured', 404)
        }

        const state = generateSessionToken()
        oauthStates.set(state, { provider: 'github', createdAt: Date.now() })

        const params = new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID,
            redirect_uri: `${env.FRONTEND_URL}/api/v1/auth/github/callback`,
            scope: 'read:user user:email',
            state,
        })

        return reply.redirect(`https://github.com/login/oauth/authorize?${params}`)
    })

    app.get('/github/callback', async (request, reply) => {
        const { code, state, error: oauthError } = request.query as { code?: string; state?: string; error?: string }

        if (oauthError || !code || !state) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=oauth_denied`)
        }

        const stored = oauthStates.get(state)
        oauthStates.delete(state)
        if (!stored || stored.provider !== 'github' || Date.now() - stored.createdAt > 600_000) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=invalid_state`)
        }

        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=not_configured`)
        }

        try {
            // Exchange code for access token
            const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    client_id: env.GITHUB_CLIENT_ID,
                    client_secret: env.GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: `${env.FRONTEND_URL}/api/v1/auth/github/callback`,
                }),
            })

            if (!tokenRes.ok) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=token_exchange`)
            }

            const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
            if (!tokenData.access_token) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=token_exchange`)
            }

            // Get user profile
            const userRes = await fetch('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'NodeRunner',
                },
            })

            if (!userRes.ok) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=user_info`)
            }

            const profile = await userRes.json() as { id: number; login: string; email?: string; name?: string; avatar_url?: string }

            // If email is private, fetch from emails endpoint
            let email = profile.email
            if (!email) {
                const emailsRes = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                        Accept: 'application/vnd.github+json',
                        'User-Agent': 'NodeRunner',
                    },
                })
                if (emailsRes.ok) {
                    const emails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[]
                    const primary = emails.find(e => e.primary && e.verified)
                    email = primary?.email ?? emails[0]?.email
                }
            }

            if (!email) {
                email = `${profile.id}@github.noreply`
            }

            const user = findOrCreateUser('github', String(profile.id), email, profile.name ?? profile.login, profile.avatar_url ?? null)

            if (bannedUsers.has(user.id)) {
                return reply.redirect(`${env.FRONTEND_URL}/signin?error=banned`)
            }

            const isAdmin = !!(env.ADMIN_EMAIL && user.email === env.ADMIN_EMAIL)
            const sessionToken = createSession(user, isAdmin)

            return reply.redirect(`${env.FRONTEND_URL}/auth/callback?token=${sessionToken}`)
        } catch {
            return reply.redirect(`${env.FRONTEND_URL}/signin?error=oauth_failed`)
        }
    })

    // Admin login with password
    app.post('/admin/login', async (request, reply) => {
        const body = request.body as { email?: string; password?: string }

        if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
            return fail(reply, 'NOT_FOUND', 'Admin login not configured', 404)
        }

        if (!body.email || !body.password) {
            return fail(reply, 'VALIDATION_ERROR', 'email and password are required')
        }

        const emailMatch = body.email.length === env.ADMIN_EMAIL.length &&
            timingSafeEqual(Buffer.from(body.email), Buffer.from(env.ADMIN_EMAIL))
        const passMatch = body.password.length === env.ADMIN_PASSWORD.length &&
            timingSafeEqual(Buffer.from(body.password), Buffer.from(env.ADMIN_PASSWORD))
        if (!emailMatch || !passMatch) {
            return fail(reply, 'UNAUTHORIZED', 'Invalid credentials', 401)
        }

        const user = findOrCreateUser('admin', body.email, body.email, 'Admin', null)
        const token = createSession(user, true)

        return ok(reply, { token, user: { ...user, isAdmin: true } })
    })

    // Get public user info
    app.get('/user/:userId', async (request, reply) => {
        const { userId } = request.params as { userId: string }
        const user = getUserById(userId)
        if (!user) {
            return fail(reply, 'NOT_FOUND', 'User not found', 404)
        }
        return ok(reply, user)
    })

    // Admin: ban/unban a user
    app.post('/admin/ban/:userId', async (request, reply) => {
        const currentUser = getUserFromRequest(request)
        if (!currentUser?.isAdmin) {
            return fail(reply, 'FORBIDDEN', 'Admin access required', 403)
        }

        const { userId } = request.params as { userId: string }
        const targetUser = getUserById(userId)
        if (!targetUser) {
            return fail(reply, 'NOT_FOUND', 'User not found', 404)
        }

        if (bannedUsers.has(userId)) {
            unbanUser(userId)
            return ok(reply, { banned: false })
        } else {
            banUser(userId)
            return ok(reply, { banned: true })
        }
    })

    // Logout
    app.post('/logout', async (request, reply) => {
        const authHeader = request.headers.authorization
        if (authHeader && typeof authHeader === 'string') {
            const token = authHeader.replace('Bearer ', '')
            sessions.delete(token)
        }
        return ok(reply, { success: true })
    })

    // Cleanup expired OAuth states periodically
    setInterval(() => {
        const now = Date.now()
        for (const [state, data] of oauthStates.entries()) {
            if (now - data.createdAt > 600_000) oauthStates.delete(state)
        }
    }, 60_000)
}
