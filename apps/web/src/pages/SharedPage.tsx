import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useGetShare, useToggleLike, useToggleSave, useDeleteShare, useToggleBan, useAuth } from '@/hooks/useApi'
import { useAuthStore } from '@/stores/nodeStore'
import { NodeGraph } from '@/components/NodeGraph'
import { UserAvatar } from '@/components/UserAvatar'
import type { NodeTree } from '@node-runner/shared'

interface ShareData {
    id: string
    slug: string
    title: string
    description: string | null
    content: string
    format: string
    nodeCount: number
    linkCount: number
    tags: string[]
    images: string[]
    previewColor: string | null
    tree: NodeTree | null
    authorId: string | null
    authorName: string
    authorAvatarUrl: string | null
    likes: number
    liked: boolean
    saved: boolean
    createdAt: string
}

export function SharedPage() {
    const { id } = useParams<{ id: string }>()
    const { data: page, isLoading, error } = useGetShare<ShareData>(id ?? '')
    const likeMutation = useToggleLike()
    const saveMutation = useToggleSave()
    const deleteMutation = useDeleteShare()
    const banMutation = useToggleBan()
    const { user: currentUser } = useAuth()
    const { token } = useAuthStore()
    const navigate = useNavigate()
    const [copiedData, setCopiedData] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [graphFullscreen, setGraphFullscreen] = useState(false)

    const pageImages = page?.images ?? []

    // Lightbox keyboard and swipe handling
    const closeLightbox = useCallback(() => setLightboxIndex(null), [])
    const prevImage = useCallback(() => setLightboxIndex((i) => i !== null && i > 0 ? i - 1 : i), [])
    const nextImage = useCallback(() => setLightboxIndex((i) => i !== null && i < pageImages.length - 1 ? i + 1 : i), [pageImages.length])

    useEffect(() => {
        if (lightboxIndex === null && !graphFullscreen) return
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                if (graphFullscreen) setGraphFullscreen(false)
                else closeLightbox()
            }
            if (lightboxIndex !== null) {
                if (e.key === 'ArrowLeft') prevImage()
                if (e.key === 'ArrowRight') nextImage()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [lightboxIndex, graphFullscreen, closeLightbox, prevImage, nextImage])

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
                <p className="text-sm text-[var(--color-text-faint)]">Loading...</p>
            </div>
        )
    }

    if (error || !page) {
        return (
            <div className="mx-auto max-w-5xl px-6 py-12">
                <h1 className="text-2xl font-bold">Not Found</h1>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">This shared page doesn't exist or has been removed.</p>
            </div>
        )
    }

    function handleCopyData() {
        navigator.clipboard.writeText(page!.content)
        setCopiedData(true)
        setTimeout(() => setCopiedData(false), 1500)
    }

    function handleCopyLink() {
        navigator.clipboard.writeText(window.location.href)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 1500)
    }

    function handleLike() {
        if (page) likeMutation.mutate(page.slug)
    }

    function handleSave() {
        if (!token) { navigate('/signin'); return }
        if (page) saveMutation.mutate(page.slug)
    }

    return (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
            {/* Header */}
            <div className="mb-6 sm:mb-4">
                <h1 className="text-xl sm:text-3xl font-bold">{page.title}</h1>
            </div>

            <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
                    {/* Image Gallery */}
                    {pageImages.length > 0 && (
                        <div className="space-y-2">
                            {/* Hero image (first) */}
                            <button
                                type="button"
                                onClick={() => setLightboxIndex(0)}
                                className="w-full rounded-md border border-[var(--color-border)] overflow-hidden cursor-pointer block"
                            >
                                <img src={pageImages[0]} alt={page.title} className="w-full object-cover" style={{ maxHeight: '350px' }} />
                            </button>
                            {/* Thumbnails (rest) */}
                            {pageImages.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto">
                                    {pageImages.slice(1).map((img, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setLightboxIndex(i + 1)}
                                            className="shrink-0 rounded-md border border-[var(--color-border)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                                        >
                                            <img src={img} alt={`Image ${i + 2}`} className="h-20 w-28 object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Graph Preview */}
                    {page.tree && Object.keys(page.tree.nodes).length > 0 ? (
                        <div className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden" style={{ height: '350px' }}>
                            <NodeGraph tree={page.tree} className="h-full w-full" />
                            <button
                                type="button"
                                onClick={() => setGraphFullscreen(true)}
                                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md bg-black/40 text-white/70 hover:bg-black/60 hover:text-white cursor-pointer transition-colors z-10"
                                title="Fullscreen"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                            </button>
                        </div>
                    ) : pageImages.length === 0 ? (
                        <div className="flex h-72 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
                            <p className="text-sm text-[var(--color-text-faint)]">No graph preview available</p>
                        </div>
                    ) : null}

                    {/* Description */}
                    {page.description && (
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <h3 className="mb-2 text-sm font-semibold">Description</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">{page.description}</p>
                        </div>
                    )}

                    {/* Node Data / JSON Viewer */}
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 sm:px-4 py-2.5 sm:py-3">
                            <h3 className="text-sm font-semibold">Node Data</h3>
                            <button
                                onClick={handleCopyData}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors cursor-pointer ${copiedData ? 'border-green-500/40 text-green-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                            >
                                {copiedData ? (
                                    <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
                                ) : (
                                    <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Copy</>
                                )}
                            </button>
                        </div>
                        <pre className="max-h-80 overflow-auto p-4 font-mono text-xs text-[var(--color-text-muted)] leading-relaxed">
                            {page.content}
                        </pre>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Metadata */}
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <h3 className="mb-3 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Details</h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--color-text-muted)]">Creator</dt>
                                <dd className="flex items-center gap-2">
                                    <UserAvatar name={page.authorName} avatarUrl={page.authorAvatarUrl} userId={page.authorId} size="sm" />
                                    {page.authorId ? (
                                        <Link to={`/user/${page.authorId}`} className="text-[var(--color-accent)] hover:underline">
                                            @{page.authorName}
                                        </Link>
                                    ) : (
                                        <>@{page.authorName}</>
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-[var(--color-text-muted)]">Date</dt>
                                <dd>{(() => { const d = new Date(page.createdAt); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}` })()}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-[var(--color-text-muted)]">Nodes</dt>
                                <dd>{page.nodeCount ?? 0}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-[var(--color-text-muted)]">Links</dt>
                                <dd>{page.linkCount ?? 0}</dd>
                            </div>
                        </dl>
                        {page.tags && page.tags.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                                <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Tags</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {page.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded bg-[var(--color-surface-hover)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleLike}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${page.liked
                                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            <svg className="h-4 w-4" fill={page.liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            {page.likes}
                        </button>
                        <button
                            onClick={handleSave}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${page.saved
                                ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            <svg className="h-4 w-4" fill={page.saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            {page.saved ? 'Saved' : 'Save'}
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleCopyData}
                            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${copiedData ? 'bg-green-600 text-white' : 'bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-hover)]'}`}
                        >
                            {copiedData ? (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
                            ) : (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Copy Node Data</>
                            )}
                        </button>
                        <button
                            onClick={handleCopyLink}
                            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${copiedLink ? 'border-green-500/40 text-green-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]'}`}
                        >
                            {copiedLink ? (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
                            ) : (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>Copy Link</>
                            )}
                        </button>
                    </div>

                    {/* Admin controls */}
                    {currentUser?.isAdmin && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4">
                            <h3 className="mb-3 text-xs font-semibold text-red-400 uppercase tracking-wide">Admin</h3>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        if (!confirm('Delete this post?')) return
                                        deleteMutation.mutate(page!.slug, {
                                            onSuccess: () => navigate('/discover'),
                                        })
                                    }}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Delete Post
                                </button>
                                {page!.authorId && (
                                    <button
                                        onClick={() => {
                                            if (!confirm('Ban this user?')) return
                                            banMutation.mutate(page!.authorId!)
                                        }}
                                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                        {banMutation.data?.banned === false ? 'Unbanned' : 'Ban User'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Graph Fullscreen */}
            {graphFullscreen && page.tree && (
                <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
                    <button
                        onClick={() => setGraphFullscreen(false)}
                        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer z-10"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="flex-1">
                        <NodeGraph tree={page.tree} className="h-full w-full" />
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && pageImages[lightboxIndex] && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                    onClick={closeLightbox}
                    onTouchStart={(e) => {
                        const startX = e.touches[0].clientX
                        const onEnd = (ev: TouchEvent) => {
                            const dx = ev.changedTouches[0].clientX - startX
                            if (dx > 60) prevImage()
                            else if (dx < -60) nextImage()
                            document.removeEventListener('touchend', onEnd)
                        }
                        document.addEventListener('touchend', onEnd, { once: true })
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={closeLightbox}
                        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer z-10"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Previous */}
                    {lightboxIndex > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); prevImage() }}
                            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer z-10"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}

                    {/* Image */}
                    <img
                        src={pageImages[lightboxIndex]}
                        alt={`Image ${lightboxIndex + 1}`}
                        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Next */}
                    {lightboxIndex < pageImages.length - 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); nextImage() }}
                            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer z-10"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}

                    {/* Counter */}
                    {pageImages.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                            {lightboxIndex + 1} / {pageImages.length}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
