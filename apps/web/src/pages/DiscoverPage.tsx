import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useListShares, useToggleLike, useToggleSave } from '@/hooks/useApi'
import { useAuthStore } from '@/stores/nodeStore'
import { NodeGraph } from '@/components/NodeGraph'
import { UserAvatar } from '@/components/UserAvatar'
import { ALL_TAGS } from '@/components/TagSelect'
import { NODE_FORMATS, FORMAT_LABELS, NODE_LICENSES, LICENSE_INFO, type NodeFormat, type NodeLicense } from '@node-runner/shared'
import type { NodeTree } from '@node-runner/shared'

const ITEMS_PER_PAGE = 12

type SortOption = 'newest' | 'oldest' | 'most-liked' | 'most-nodes'
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'most-liked', label: 'Most Liked' },
    { value: 'most-nodes', label: 'Most Nodes' },
]

interface ShareItem {
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
    license?: NodeLicense
    createdAt: string
}

export function DiscoverPage() {
    const [searchParams] = useSearchParams()
    const [search, setSearch] = useState(searchParams.get('q') ?? '')
    const [activeTags, setActiveTags] = useState<string[]>([])
    const [activeFormats, setActiveFormats] = useState<NodeFormat[]>([])
    const [activeLicenses, setActiveLicenses] = useState<NodeLicense[]>([])
    const [sortBy, setSortBy] = useState<SortOption>('newest')
    const [hasImagesOnly, setHasImagesOnly] = useState(false)
    const [minNodes, setMinNodes] = useState(0)
    const [tagSearch, setTagSearch] = useState('')
    const [tagsExpanded, setTagsExpanded] = useState(false)
    const [page, setPage] = useState(1)
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
    const { data: shares, isLoading } = useListShares()
    const likeMutation = useToggleLike()
    const saveMutation = useToggleSave()
    const { token } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        const q = searchParams.get('q')
        if (q) setSearch(q)
    }, [searchParams])

    const items = (shares as ShareItem[] | undefined) ?? []

    // Counts per tag/format/license so users see what's filterable
    const { tagCounts, formatCounts, licenseCounts } = useMemo(() => {
        const tc = new Map<string, number>()
        const fc = new Map<string, number>()
        const lc = new Map<string, number>()
        for (const it of items) {
            for (const t of it.tags ?? []) tc.set(t, (tc.get(t) ?? 0) + 1)
            if (it.format) fc.set(it.format, (fc.get(it.format) ?? 0) + 1)
            if (it.license) lc.set(it.license, (lc.get(it.license) ?? 0) + 1)
        }
        return { tagCounts: tc, formatCounts: fc, licenseCounts: lc }
    }, [items])

    const filtered = useMemo(() => {
        return items
            .filter((item) => {
                const matchesSearch = !search ||
                    item.title.toLowerCase().includes(search.toLowerCase()) ||
                    (item.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
                    item.authorName.toLowerCase().includes(search.toLowerCase())
                const matchesTags = activeTags.length === 0 || activeTags.every((t) => item.tags?.includes(t))
                const matchesFormat = activeFormats.length === 0 || activeFormats.includes(item.format as NodeFormat)
                const matchesLicense = activeLicenses.length === 0 || (item.license !== undefined && activeLicenses.includes(item.license))
                const matchesImages = !hasImagesOnly || (item.images?.length ?? 0) > 0
                const matchesMinNodes = item.nodeCount >= minNodes
                return matchesSearch && matchesTags && matchesFormat && matchesLicense && matchesImages && matchesMinNodes
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'oldest': return a.createdAt.localeCompare(b.createdAt)
                    case 'most-liked': return b.likes - a.likes
                    case 'most-nodes': return b.nodeCount - a.nodeCount
                    case 'newest':
                    default: return b.createdAt.localeCompare(a.createdAt)
                }
            })
    }, [items, search, activeTags, activeFormats, activeLicenses, hasImagesOnly, minNodes, sortBy])

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    useEffect(() => { setPage(1) }, [search, activeTags, activeFormats, activeLicenses, hasImagesOnly, minNodes, sortBy])

    function toggleTag(tag: string) {
        setActiveTags((curr) => curr.includes(tag) ? curr.filter((t) => t !== tag) : [...curr, tag])
    }

    function toggleFormat(fmt: NodeFormat) {
        setActiveFormats((curr) => curr.includes(fmt) ? curr.filter((f) => f !== fmt) : [...curr, fmt])
    }

    function toggleLicense(lic: NodeLicense) {
        setActiveLicenses((curr) => curr.includes(lic) ? curr.filter((l) => l !== lic) : [...curr, lic])
    }

    function clearFilters() {
        setSearch('')
        setActiveTags([])
        setActiveFormats([])
        setActiveLicenses([])
        setHasImagesOnly(false)
        setMinNodes(0)
        setTagSearch('')
    }

    const activeFilterCount =
        (search ? 1 : 0) +
        activeTags.length +
        activeFormats.length +
        activeLicenses.length +
        (hasImagesOnly ? 1 : 0) +
        (minNodes > 0 ? 1 : 0)

    // Tag list: filter by tagSearch, sort by count desc, collapse to top 15 unless expanded
    const visibleTags = useMemo(() => {
        const q = tagSearch.trim().toLowerCase()
        const list = ALL_TAGS
            .filter((t) => !q || t.toLowerCase().includes(q))
            .map((t) => ({ name: t, count: tagCounts.get(t) ?? 0 }))
            .sort((a, b) => {
                // Active tags always first, then by count, then alpha
                const aActive = activeTags.includes(a.name) ? 1 : 0
                const bActive = activeTags.includes(b.name) ? 1 : 0
                if (aActive !== bActive) return bActive - aActive
                if (a.count !== b.count) return b.count - a.count
                return a.name.localeCompare(b.name)
            })
        return tagsExpanded || q ? list : list.slice(0, 15)
    }, [tagSearch, tagsExpanded, tagCounts, activeTags])

    const sidebar = (
        <aside className="space-y-5">
            {/* Search */}
            <div>
                <label htmlFor="discover-search" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Search</label>
                <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        id="discover-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Title, description, author…"
                        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                    />
                </div>
            </div>

            {/* Sort */}
            <div>
                <label htmlFor="discover-sort" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Sort by</label>
                <select
                    id="discover-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                >
                    {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Format */}
            <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Format</h3>
                <div className="space-y-1">
                    {NODE_FORMATS.map((fmt) => {
                        const count = formatCounts.get(fmt) ?? 0
                        const active = activeFormats.includes(fmt)
                        return (
                            <label key={fmt} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-colors ${active ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'}`}>
                                <span className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={active}
                                        onChange={() => toggleFormat(fmt)}
                                        className="accent-[var(--color-accent)] cursor-pointer"
                                    />
                                    {FORMAT_LABELS[fmt]}
                                </span>
                                <span className="text-xs text-[var(--color-text-faint)]">{count}</span>
                            </label>
                        )
                    })}
                </div>
            </div>

            {/* License */}
            <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">License</h3>
                <div className="space-y-1">
                    {NODE_LICENSES.map((lic) => {
                        const count = licenseCounts.get(lic) ?? 0
                        const active = activeLicenses.includes(lic)
                        return (
                            <label key={lic} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-colors ${active ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'}`}>
                                <span className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={active}
                                        onChange={() => toggleLicense(lic)}
                                        className="accent-[var(--color-accent)] cursor-pointer"
                                    />
                                    {LICENSE_INFO[lic].short}
                                </span>
                                <span className="text-xs text-[var(--color-text-faint)]">{count}</span>
                            </label>
                        )
                    })}
                </div>
            </div>

            {/* Tags */}
            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Tags</h3>
                    {activeTags.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTags([])}
                            className="text-[10px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] cursor-pointer"
                        >
                            Clear ({activeTags.length})
                        </button>
                    )}
                </div>
                <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Filter tags…"
                    className="mb-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                    {visibleTags.map(({ name, count }) => {
                        const active = activeTags.includes(name)
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => toggleTag(name)}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer ${active
                                    ? 'bg-[var(--color-accent)] text-black font-medium'
                                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                                    }`}
                            >
                                {name}
                                {count > 0 && <span className={`text-[10px] ${active ? 'text-black/60' : 'text-[var(--color-text-faint)]'}`}>{count}</span>}
                            </button>
                        )
                    })}
                </div>
                {!tagSearch && ALL_TAGS.length > 15 && (
                    <button
                        type="button"
                        onClick={() => setTagsExpanded((e) => !e)}
                        className="mt-2 text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
                    >
                        {tagsExpanded ? 'Show fewer' : `Show all ${ALL_TAGS.length} tags`}
                    </button>
                )}
            </div>

            {/* Other filters */}
            <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Other</h3>
                <label className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
                    <span className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={hasImagesOnly}
                            onChange={(e) => setHasImagesOnly(e.target.checked)}
                            className="accent-[var(--color-accent)] cursor-pointer"
                        />
                        Has preview image
                    </span>
                </label>
                <div className="mt-3 px-2">
                    <label htmlFor="discover-min-nodes" className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <span>Min nodes</span>
                        <span className="font-mono">{minNodes}</span>
                    </label>
                    <input
                        id="discover-min-nodes"
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={minNodes}
                        onChange={(e) => setMinNodes(Number(e.target.value))}
                        className="mt-1 w-full accent-[var(--color-accent)] cursor-pointer"
                    />
                </div>
            </div>

            {activeFilterCount > 0 && (
                <button
                    type="button"
                    onClick={clearFilters}
                    className="w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors cursor-pointer"
                >
                    Clear all filters ({activeFilterCount})
                </button>
            )}
        </aside>
    )

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Browse</h1>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                        {isLoading ? 'Loading…' : `${filtered.length} of ${items.length} node tree${items.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                {/* Mobile filter toggle */}
                <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="lg:hidden inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filters {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-semibold text-black">{activeFilterCount}</span>}
                </button>
            </div>

            <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
                {/* Desktop sidebar - sticky */}
                <div className="hidden lg:block">
                    <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2">
                        {sidebar}
                    </div>
                </div>

                {/* Results */}
                <div className="min-w-0">
                    {isLoading && (
                        <p className="py-12 text-center text-sm text-[var(--color-text-faint)]">Loading…</p>
                    )}
                    {!isLoading && filtered.length === 0 && (
                        <div className="py-16 text-center">
                            <p className="text-sm text-[var(--color-text-faint)]">No node trees match your filters.</p>
                            {activeFilterCount > 0 && (
                                <button type="button" onClick={clearFilters} className="mt-3 text-sm text-[var(--color-accent)] hover:underline cursor-pointer">
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}

                    {/* Active filter chips */}
                    {(activeTags.length > 0 || activeFormats.length > 0 || activeLicenses.length > 0) && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                            {activeFormats.map((fmt) => (
                                <button key={fmt} onClick={() => toggleFormat(fmt)} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer">
                                    {FORMAT_LABELS[fmt]} ×
                                </button>
                            ))}
                            {activeLicenses.map((lic) => (
                                <button key={lic} onClick={() => toggleLicense(lic)} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer">
                                    {LICENSE_INFO[lic].short} ×
                                </button>
                            ))}
                            {activeTags.map((tag) => (
                                <button key={tag} onClick={() => toggleTag(tag)} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 cursor-pointer">
                                    {tag} ×
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {paginated.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => navigate(`/share/${item.slug}`)}
                                className="group flex flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-text-faint)] cursor-pointer"
                            >
                                <div className="h-32 w-full bg-[var(--color-bg)] overflow-hidden">
                                    {item.images?.[0] ? (
                                        <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                                    ) : item.tree && Object.keys(item.tree.nodes).length > 0 ? (
                                        <div className="h-full w-full pointer-events-none">
                                            <NodeGraph tree={item.tree} className="h-full w-full" compact />
                                        </div>
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <svg className="h-8 w-8 text-[var(--color-text-faint)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" /></svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <UserAvatar name={item.authorName} avatarUrl={item.authorAvatarUrl} userId={item.authorId} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                                    {item.title}
                                                </h3>
                                                <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)] truncate">
                                                    {item.authorId ? (
                                                        <Link to={`/user/${item.authorId}`} onClick={(e) => e.stopPropagation()} className="hover:text-[var(--color-accent)] hover:underline">
                                                            {item.authorName}
                                                        </Link>
                                                    ) : item.authorName}
                                                    {' · '}{item.nodeCount} node{item.nodeCount !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); likeMutation.mutate(item.slug) }}
                                                aria-label={item.liked ? 'Unlike' : 'Like'}
                                                className={`inline-flex items-center gap-0.5 cursor-pointer transition-colors p-1 ${item.liked ? 'text-red-400' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'}`}
                                            >
                                                <svg className="h-4 w-4" fill={item.liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                <span className="text-[11px]">{item.likes}</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); token ? saveMutation.mutate(item.slug) : navigate('/signin') }}
                                                aria-label={item.saved ? 'Unsave' : 'Save'}
                                                className={`inline-flex items-center cursor-pointer transition-colors p-1 ${item.saved ? 'text-blue-400' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'}`}
                                            >
                                                <svg className="h-4 w-4" fill={item.saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            </button>
                                        </span>
                                    </div>
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {item.tags.slice(0, 4).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {item.tags.length > 4 && (
                                                <span className="text-[10px] text-[var(--color-text-faint)] py-0.5">+{item.tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
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

            {/* Mobile filter drawer */}
            {mobileFiltersOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFiltersOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--color-bg)] border-r border-[var(--color-border)] overflow-y-auto p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold">Filters</h2>
                            <button
                                type="button"
                                onClick={() => setMobileFiltersOpen(false)}
                                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                                aria-label="Close filters"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        {sidebar}
                    </div>
                </div>
            )}
        </div>
    )
}
