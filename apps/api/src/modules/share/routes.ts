import type { FastifyPluginAsync } from 'fastify'
import { createShareRequestSchema } from '@node-runner/schemas'
import { DefaultFormatDetector, PlaceholderParser } from '@node-runner/core'
import type { NodeTreeMetadata } from '@node-runner/shared'
import { ok, fail } from '../../lib/response.js'
import { getUserFromRequest, isUserBanned } from '../auth/routes.js'
import { PersistedMap, PersistedMapOfSets } from '../../lib/persist.js'

const detector = new DefaultFormatDetector()
const parser = new PlaceholderParser()

function generateSlug(): string {
    return Math.random().toString(36).substring(2, 10)
}

const shareStore = new PersistedMap<Record<string, unknown>>('shares')
const likesStore = new PersistedMapOfSets('likes')
const savesStore = new PersistedMapOfSets('saves')

// Per-IP anonymous upload tracking
const anonUploads = new Map<string, { count: number; resetAt: number }>()
const ANON_LIMIT = 10
const ANON_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkAnonRateLimit(ip: string): boolean {
    const now = Date.now()
    const entry = anonUploads.get(ip)
    if (!entry || now > entry.resetAt) {
        anonUploads.set(ip, { count: 1, resetAt: now + ANON_WINDOW_MS })
        return true
    }
    if (entry.count >= ANON_LIMIT) return false
    entry.count++
    return true
}

function getLikeCount(slug: string): number {
    return likesStore.get(slug)?.size ?? 0
}

function getLikerIdentifier(request: { ip: string; headers: Record<string, string | string[] | undefined> }): string {
    const user = getUserFromRequest(request)
    return user ? `user:${user.userId}` : `ip:${request.ip}`
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
    // Create a shared page
    app.post('/share', async (request, reply) => {
        const parsed = createShareRequestSchema.safeParse(request.body)
        if (!parsed.success) {
            return fail(reply, 'VALIDATION_ERROR', parsed.error.issues[0].message)
        }

        const user = getUserFromRequest(request)

        // Check if user is banned
        if (user && isUserBanned(user.userId)) {
            return fail(reply, 'FORBIDDEN', 'Your account has been banned', 403)
        }

        // Rate limit anonymous uploads
        if (!user) {
            const ip = request.ip
            if (!checkAnonRateLimit(ip)) {
                return fail(reply, 'RATE_LIMIT', 'Anonymous upload limit reached. Sign in for more.', 429)
            }
        }

        // Validate content is parseable
        const { content, format, title, description, isPublic, tags, images } = parsed.data
        const detectedFormat = detector.detect(content)
        const sourceFormat = format ?? detectedFormat.format

        let metadata: NodeTreeMetadata
        let tree = null
        try {
            const parsed = parser.parse(content, sourceFormat)
            const nodeNames = Object.keys(parsed.nodes)
            metadata = {
                nodeCount: nodeNames.length,
                linkCount: parsed.links.length,
                nodeTypes: [...new Set(nodeNames.map((n) => parsed.nodes[n].type))],
                hasGroups: nodeNames.some((n) => parsed.nodes[n].type === 'ShaderNodeGroup'),
                format: sourceFormat,
                warnings: [],
            }
            if (nodeNames.length > 0) {
                tree = parsed
            }
        } catch {
            // Still allow upload even if parsing fails — store raw content
            metadata = {
                nodeCount: 0,
                linkCount: 0,
                nodeTypes: [],
                hasGroups: false,
                format: sourceFormat,
                warnings: ['Could not fully parse the content'],
            }
        }

        const slug = generateSlug()
        const now = new Date().toISOString()

        const record = {
            id: slug,
            slug,
            title,
            description: description ?? null,
            content,
            format: sourceFormat,
            nodeCount: metadata.nodeCount,
            linkCount: metadata.linkCount,
            tree,
            metadata,
            isPublic: isPublic ?? true,
            previewColor: null,
            images: images ?? [],
            tags: tags ?? [],
            authorId: user?.userId ?? null,
            authorName: user?.name ?? user?.email ?? 'Anonymous',
            authorAvatarUrl: user?.avatarUrl ?? null,
            likes: 0,
            createdAt: now,
            updatedAt: now,
        }

        shareStore.set(slug, record)
        return ok(reply, record, 201)
    })

    // List current user's uploads (must be before :id route)
    app.get('/share/my', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        }

        const myPages = Array.from(shareStore.values())
            .filter((r) => r.authorId === user.userId)
            .sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string))

        return ok(reply, myPages)
    })

    // Get liked items for current user (must be before :id route)
    app.get('/share/liked', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        }

        const identifier = `user:${user.userId}`
        const likedSlugs: string[] = []
        for (const [slug, likers] of likesStore.entries()) {
            if (likers.has(identifier)) likedSlugs.push(slug)
        }

        const items = likedSlugs
            .map((slug) => shareStore.get(slug))
            .filter(Boolean)
            .map((r) => ({
                ...r,
                likes: getLikeCount(r!.slug as string),
                liked: true,
                saved: savesStore.get(user.userId)?.has(r!.slug as string) ?? false,
            }))

        return ok(reply, items)
    })

    // Get saved items for current user (must be before :id route)
    app.get('/share/saved', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        }

        const savedSlugs = savesStore.get(user.userId) ?? new Set()
        const items = Array.from(savedSlugs)
            .map((slug) => shareStore.get(slug))
            .filter(Boolean)
            .map((r) => ({
                ...r,
                likes: getLikeCount(r!.slug as string),
                liked: likesStore.get(r!.slug as string)?.has(`user:${user.userId}`) ?? false,
                saved: true,
            }))

        return ok(reply, items)
    })

    // Get public uploads for a specific user (must be before :id route)
    app.get('/share/user/:userId', async (request, reply) => {
        const { userId } = request.params as { userId: string }
        const identifier = getLikerIdentifier(request)
        const currentUser = getUserFromRequest(request)

        const userPages = Array.from(shareStore.values())
            .filter((r) => r.authorId === userId && r.isPublic)
            .sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string))
            .map((r) => ({
                ...r,
                likes: getLikeCount(r.slug as string),
                liked: likesStore.get(r.slug as string)?.has(identifier) ?? false,
                saved: currentUser ? (savesStore.get(currentUser.userId)?.has(r.slug as string) ?? false) : false,
            }))

        return ok(reply, userPages)
    })

    // Get a shared page
    app.get('/share/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const record = shareStore.get(id)

        if (!record) {
            return fail(reply, 'NOT_FOUND', 'Shared page not found', 404)
        }

        const identifier = getLikerIdentifier(request)
        const user = getUserFromRequest(request)

        return ok(reply, {
            ...record,
            likes: getLikeCount(id),
            liked: likesStore.get(id)?.has(identifier) ?? false,
            saved: user ? (savesStore.get(user.userId)?.has(id) ?? false) : false,
        })
    })

    // List public shared pages
    app.get('/share', async (request, reply) => {
        const identifier = getLikerIdentifier(request)
        const user = getUserFromRequest(request)

        const publicPages = Array.from(shareStore.values())
            .filter((r) => r.isPublic)
            .sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string))
            .slice(0, 50)
            .map((r) => ({
                ...r,
                likes: getLikeCount(r.slug as string),
                liked: likesStore.get(r.slug as string)?.has(identifier) ?? false,
                saved: user ? (savesStore.get(user.userId)?.has(r.slug as string) ?? false) : false,
            }))

        return ok(reply, publicPages)
    })

    // Delete a shared page (owner or admin)
    app.delete('/share/:id', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        }

        const { id } = request.params as { id: string }
        const record = shareStore.get(id)
        if (!record) {
            return fail(reply, 'NOT_FOUND', 'Shared page not found', 404)
        }
        if (record.authorId !== user.userId && !user.isAdmin) {
            return fail(reply, 'FORBIDDEN', 'You can only delete your own uploads', 403)
        }

        shareStore.delete(id)
        return ok(reply, { deleted: true })
    })

    // Update a shared page (owner or admin)
    app.patch('/share/:id', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        }

        const { id } = request.params as { id: string }
        const record = shareStore.get(id)
        if (!record) {
            return fail(reply, 'NOT_FOUND', 'Shared page not found', 404)
        }
        if (record.authorId !== user.userId && !user.isAdmin) {
            return fail(reply, 'FORBIDDEN', 'You can only edit your own uploads', 403)
        }

        const body = request.body as Record<string, unknown>
        if (typeof body.title === 'string' && body.title.trim().length > 0 && body.title.trim().length <= 120) {
            record.title = body.title.trim()
        }
        if (typeof body.description === 'string' && body.description.length <= 1000) {
            record.description = body.description.trim() || null
        }

        // Update tags
        if (Array.isArray(body.tags)) {
            const tags = (body.tags as string[]).filter(t => typeof t === 'string' && t.length <= 30).slice(0, 10)
            record.tags = tags
        }

        // Update images
        if (Array.isArray(body.images)) {
            record.images = (body.images as string[]).filter(i => typeof i === 'string' && i.length > 0).slice(0, 4)
        }

        // Allow updating node tree content
        if (typeof body.content === 'string' && body.content.trim().length > 0) {
            const content = body.content.trim()
            const detectedFormat = detector.detect(content)
            const sourceFormat = detectedFormat.format
            record.content = content
            record.format = sourceFormat

            try {
                const parsed = parser.parse(content, sourceFormat)
                const nodeNames = Object.keys(parsed.nodes)
                record.nodeCount = nodeNames.length
                record.linkCount = parsed.links.length
                record.tree = nodeNames.length > 0 ? parsed : null
                record.metadata = {
                    nodeCount: nodeNames.length,
                    linkCount: parsed.links.length,
                    nodeTypes: [...new Set(nodeNames.map((n) => parsed.nodes[n].type))],
                    hasGroups: nodeNames.some((n) => parsed.nodes[n].type === 'ShaderNodeGroup'),
                    format: sourceFormat,
                    warnings: [],
                }
            } catch {
                record.tree = null
                record.nodeCount = 0
                record.linkCount = 0
            }
        }

        record.updatedAt = new Date().toISOString()

        shareStore.set(id, record)
        return ok(reply, record)
    })

    // Toggle like (no login required — uses IP or userId)
    app.post('/share/:id/like', async (request, reply) => {
        const { id } = request.params as { id: string }
        if (!shareStore.has(id)) {
            return fail(reply, 'NOT_FOUND', 'Shared page not found', 404)
        }

        const identifier = getLikerIdentifier(request)
        const likes = likesStore.getOrCreate(id)

        if (likes.has(identifier)) {
            likes.delete(identifier)
            likesStore.markDirty()
            return ok(reply, { liked: false, likes: likes.size })
        } else {
            likes.add(identifier)
            likesStore.markDirty()
            return ok(reply, { liked: true, likes: likes.size })
        }
    })

    // Toggle save (login required)
    app.post('/share/:id/save', async (request, reply) => {
        const user = getUserFromRequest(request)
        if (!user) {
            return fail(reply, 'UNAUTHORIZED', 'Login required to save', 401)
        }

        const { id } = request.params as { id: string }
        if (!shareStore.has(id)) {
            return fail(reply, 'NOT_FOUND', 'Shared page not found', 404)
        }

        const saves = savesStore.getOrCreate(user.userId)

        if (saves.has(id)) {
            saves.delete(id)
            savesStore.markDirty()
            return ok(reply, { saved: false })
        } else {
            saves.add(id)
            savesStore.markDirty()
            return ok(reply, { saved: true })
        }
    })
}
