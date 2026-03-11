import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useListShares, useToggleLike, useToggleSave } from '@/hooks/useApi'
import { useAuthStore } from '@/stores/nodeStore'
import { NodeGraph } from '@/components/NodeGraph'
import { UserAvatar } from '@/components/UserAvatar'
import { ALL_TAGS } from '@/components/TagSelect'
import type { NodeTree } from '@node-runner/shared'

const FILTER_TAGS = ALL_TAGS.slice(0, 12) // Show top tags as quick filters
const ITEMS_PER_PAGE = 12

type SortOption = 'newest' | 'oldest' | 'most-liked' | 'most-nodes'
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'most-liked', label: 'Most Liked' },
    { value: 'most-nodes', label: 'Most Nodes' },
]

export function DiscoverPage() {
    const [searchParams] = useSearchParams()
    const [search, setSearch] = useState(searchParams.get('q') ?? '')
    const [activeTag, setActiveTag] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<SortOption>('newest')
    const [page, setPage] = useState(1)
    const { data: shares, isLoading } = useListShares()
    const likeMutation = useToggleLike()
    const saveMutation = useToggleSave()
    const { token } = useAuthStore()
    const navigate = useNavigate()

    // Sync search from URL query param
    useEffect(() => {
        const q = searchParams.get('q')
        if (q) setSearch(q)
    }, [searchParams])

    const items = (shares as Array<{
        id: string
        slug: string
        title: string
        format: string
        nodeCount: number
        linkCount: number
        tags: string[]
        description: string | null
        previewColor: string | null
        tree: NodeTree | null
        authorId: string | null
        authorName: string
        authorAvatarUrl: string | null
        likes: number
        liked: boolean
        saved: boolean
        images: string[]
        createdAt: string
    }>) ?? []

    const filtered = items
        .filter((item) => {
            const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase())
            const matchesTag = !activeTag || item.tags?.includes(activeTag)
            return matchesSearch && matchesTag
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return (a.createdAt as string).localeCompare(b.createdAt as string)
                case 'most-liked':
                    return b.likes - a.likes
                case 'most-nodes':
                    return b.nodeCount - a.nodeCount
                case 'newest':
                default:
                    return (b.createdAt as string).localeCompare(a.createdAt as string)
            }
        })

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    // Reset page when filters change
    useEffect(() => { setPage(1) }, [search, activeTag, sortBy])

    return (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
            <h1 className="text-2xl font-bold">Discover</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Browse shared node trees from the community.
            </p>

            {/* Search & Filters */}
            <div className="mt-8 space-y-4">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveTag(null)}
                        className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${!activeTag
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                            }`}
                    >
                        All
                    </button>
                    {FILTER_TAGS.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${activeTag === tag
                                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort + count */}
            <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-[var(--color-text-faint)]">
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--color-text-muted)]" htmlFor="sort-select">Sort by</label>
                    <select
                        id="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results */}
            <div className="mt-4">
                {isLoading && (
                    <p className="py-12 text-center text-sm text-[var(--color-text-faint)]">Loading...</p>
                )}
                {!isLoading && filtered.length === 0 && (
                    <p className="py-12 text-center text-sm text-[var(--color-text-faint)]">
                        No shared node trees found.
                    </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {paginated.map((item) => {
                        return (
                            <div
                                key={item.id}
                                onClick={() => navigate(`/share/${item.slug}`)}
                                className="group flex flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors hover:bg-[var(--color-surface-hover)] cursor-pointer"
                            >
                                {/* Cover image or graph preview */}
                                <div className="h-32 w-full bg-[var(--color-bg)] overflow-hidden">
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
                                </div>
                                <div className="flex flex-1 flex-col p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <UserAvatar name={item.authorName} avatarUrl={item.authorAvatarUrl} userId={item.authorId} size="md" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                                    {item.title}
                                                </h3>
                                                <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                                                    by {item.authorId ? (
                                                        <Link to={`/user/${item.authorId}`} onClick={(e) => e.stopPropagation()} className="hover:text-[var(--color-accent)] hover:underline">
                                                            {item.authorName}
                                                        </Link>
                                                    ) : item.authorName}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); likeMutation.mutate(item.slug) }}
                                                className={`inline-flex items-center gap-1 cursor-pointer transition-colors p-1.5 ${item.liked ? 'text-red-400' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'}`}
                                            >
                                                <svg className="h-5 w-5" fill={item.liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                <span className="text-xs">{item.likes}</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); token ? saveMutation.mutate(item.slug) : navigate('/signin') }}
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
                        )
                    })}
                </div>

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
        </div>
    )
}