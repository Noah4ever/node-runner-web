import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useUserShares, useGetUser, useToggleLike, useToggleSave } from '@/hooks/useApi'
import { useAuthStore } from '@/stores/nodeStore'
import { NodeGraph } from '@/components/NodeGraph'
import { UserAvatar } from '@/components/UserAvatar'
import type { NodeTree } from '@node-runner/shared'

const ITEMS_PER_PAGE = 12

export function UserProfilePage() {
    const { userId } = useParams<{ userId: string }>()
    const { data: userInfo, isLoading: userLoading } = useGetUser(userId ?? '')
    const { data: shares, isLoading: sharesLoading } = useUserShares(userId ?? '')
    const likeMutation = useToggleLike()
    const saveMutation = useToggleSave()
    const { token } = useAuthStore()
    const navigate = useNavigate()
    const [page, setPage] = useState(1)

    const items = (shares as Array<{
        id: string
        slug: string
        title: string
        format: string
        nodeCount: number
        linkCount: number
        tags: string[]
        description: string | null
        tree: NodeTree | null
        authorName: string
        likes: number
        liked: boolean
        saved: boolean
        images: string[]
        createdAt: string
    }>) ?? []

    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginated = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    useEffect(() => { setPage(1) }, [userId])

    const isLoading = userLoading || sharesLoading

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
                <p className="text-sm text-[var(--color-text-faint)]">Loading...</p>
            </div>
        )
    }

    const userName = userInfo?.name ?? items[0]?.authorName ?? 'User'
    const joinDate = userInfo?.createdAt ? (() => { const d = new Date(userInfo.createdAt); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}` })() : null

    return (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-8">
                <UserAvatar name={userName} avatarUrl={userInfo?.avatarUrl} size="lg" />
                <div>
                    <h1 className="text-xl font-bold">@{userName}</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        {items.length} upload{items.length !== 1 ? 's' : ''}
                        {joinDate && <> · Joined {joinDate}</>}
                    </p>
                </div>
            </div>

            {/* Uploads grid */}
            {items.length === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--color-text-faint)]">
                    This user hasn't shared anything yet.
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {paginated.map((item) => (
                        <div
                            key={item.id}
                            className="group flex flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors hover:bg-[var(--color-surface-hover)]"
                        >
                            <Link to={`/share/${item.slug}`} className="h-32 w-full bg-[var(--color-bg)] overflow-hidden block">
                                {item.images?.[0] ? (
                                    <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                                ) : item.tree && Object.keys(item.tree.nodes).length > 0 ? (
                                    <div className="h-full w-full pointer-events-none">
                                        <NodeGraph tree={item.tree} className="h-full w-full" />
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        <svg className="h-8 w-8 text-[var(--color-text-faint)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" /></svg>
                                    </div>
                                )}
                            </Link>
                            <div className="flex flex-1 flex-col p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <Link to={`/share/${item.slug}`} className="block min-w-0 flex-1">
                                        <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                            {item.title}
                                        </h3>
                                    </Link>
                                    <span className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => { e.preventDefault(); likeMutation.mutate(item.slug) }}
                                            className={`inline-flex items-center gap-1 cursor-pointer transition-colors p-1.5 ${item.liked ? 'text-red-400' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'}`}
                                        >
                                            <svg className="h-5 w-5" fill={item.liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            <span className="text-xs">{item.likes}</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); token ? saveMutation.mutate(item.slug) : navigate('/signin') }}
                                            className={`inline-flex items-center gap-1 cursor-pointer transition-colors p-1.5 ${item.saved ? 'text-blue-400' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'}`}
                                        >
                                            <svg className="h-5 w-5" fill={item.saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                        </button>
                                    </span>
                                </div>
                                {item.tags && item.tags.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1">
                                        {item.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        Previous
                    </button>
                    <span className="text-sm text-[var(--color-text-muted)]">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                    >
                        Next
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            )}
        </div>
    )
}
