import type { FastifyPluginAsync } from 'fastify'
import { ok, fail } from '../../lib/response.js'
import { getUserFromRequest, listAllUsers, banUser, unbanUser } from '../auth/routes.js'
import { shareStore, likesStore } from '../share/routes.js'

// Admin-only endpoints. All routes here check user.isAdmin and 403 otherwise.
// The actions themselves (delete/patch share, ban/unban user) live in their
// home modules; admin endpoints are the listing + read-only inventory views
// that the admin dashboard renders.

function requireAdmin(request: { headers: Record<string, string | string[] | undefined> }) {
    const user = getUserFromRequest(request)
    if (!user) return { error: 'UNAUTHORIZED' as const }
    if (!user.isAdmin) return { error: 'FORBIDDEN' as const }
    return { user }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
    // Full share list - admin sees private too. Compact projection so the
    // dashboard table doesn't get megabytes of tree + image data.
    app.get('/admin/shares', async (request, reply) => {
        const guard = requireAdmin(request)
        if (guard.error === 'UNAUTHORIZED') return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        if (guard.error === 'FORBIDDEN') return fail(reply, 'FORBIDDEN', 'Admin only', 403)

        const items: Array<Record<string, unknown>> = []
        for (const r of shareStore.values()) {
            items.push({
                id: r.id,
                slug: r.slug,
                title: r.title,
                description: r.description,
                format: r.format,
                isPublic: r.isPublic,
                nodeCount: r.nodeCount,
                linkCount: r.linkCount,
                tags: r.tags,
                license: r.license,
                authorId: r.authorId,
                authorName: r.authorName,
                authorAvatarUrl: r.authorAvatarUrl,
                imageCount: Array.isArray(r.images) ? r.images.length : 0,
                likes: likesStore.get(r.slug as string)?.size ?? 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })
        }
        items.sort((a, b) => ((b.createdAt as string) ?? '').localeCompare((a.createdAt as string) ?? ''))
        return ok(reply, items)
    })

    // Full user list with banned status.
    app.get('/admin/users', async (request, reply) => {
        const guard = requireAdmin(request)
        if (guard.error === 'UNAUTHORIZED') return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        if (guard.error === 'FORBIDDEN') return fail(reply, 'FORBIDDEN', 'Admin only', 403)
        return ok(reply, listAllUsers())
    })

    // Ban / unban explicit endpoints under /admin for the dashboard. (The
    // /auth/admin/ban one still exists too.)
    app.post('/admin/users/:userId/ban', async (request, reply) => {
        const guard = requireAdmin(request)
        if (guard.error === 'UNAUTHORIZED') return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        if (guard.error === 'FORBIDDEN') return fail(reply, 'FORBIDDEN', 'Admin only', 403)
        const { userId } = request.params as { userId: string }
        banUser(userId)
        return ok(reply, { banned: true })
    })

    app.post('/admin/users/:userId/unban', async (request, reply) => {
        const guard = requireAdmin(request)
        if (guard.error === 'UNAUTHORIZED') return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        if (guard.error === 'FORBIDDEN') return fail(reply, 'FORBIDDEN', 'Admin only', 403)
        const { userId } = request.params as { userId: string }
        unbanUser(userId)
        return ok(reply, { banned: false })
    })

    // Aggregate stats for the dashboard header.
    app.get('/admin/stats', async (request, reply) => {
        const guard = requireAdmin(request)
        if (guard.error === 'UNAUTHORIZED') return fail(reply, 'UNAUTHORIZED', 'Login required', 401)
        if (guard.error === 'FORBIDDEN') return fail(reply, 'FORBIDDEN', 'Admin only', 403)

        let shareCount = 0
        let publicShares = 0
        let totalLikes = 0
        for (const r of shareStore.values()) {
            shareCount++
            if (r.isPublic) publicShares++
            totalLikes += likesStore.get(r.slug as string)?.size ?? 0
        }
        const users = listAllUsers()
        return ok(reply, {
            shares: shareCount,
            publicShares,
            users: users.length,
            bannedUsers: users.filter((u) => u.banned).length,
            totalLikes,
        })
    })
}
