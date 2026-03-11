import { useState, useCallback, useRef, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth, useMyShares, useDeleteShare, useUpdateShare, useLikedShares, useSavedShares } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { TagSelect } from '@/components/TagSelect'
import { NodeGraph } from '@/components/NodeGraph'
import { UserAvatar } from '@/components/UserAvatar'
import type { NodeTree } from '@node-runner/shared'

type Tab = 'uploads' | 'liked' | 'saved'

export function ProfilePage() {
    const { user, isLoggedIn, isLoading: authLoading } = useAuth()
    const [tab, setTab] = useState<Tab>('uploads')
    const { data: myShares, isLoading: sharesLoading } = useMyShares()
    const { data: likedShares, isLoading: likedLoading } = useLikedShares()
    const { data: savedShares, isLoading: savedLoading } = useSavedShares()
    const deleteMutation = useDeleteShare()
    const updateMutation = useUpdateShare()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editTags, setEditTags] = useState<string[]>([])
    const [editImages, setEditImages] = useState<string[]>([])
    const [editContentValid, setEditContentValid] = useState<boolean | null>(null)
    const [editContentChecking, setEditContentChecking] = useState(false)
    const editContentDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)

    if (authLoading) {
        return (
            <div className="mx-auto max-w-4xl px-6 py-12">
                <p className="text-sm text-[var(--color-text-faint)]">Loading...</p>
            </div>
        )
    }

    if (!isLoggedIn || !user) {
        return <Navigate to="/signin" replace />
    }

    const uploads = (myShares as Array<{
        id: string
        slug: string
        title: string
        description: string | null
        format: string
        nodeCount: number
        linkCount: number
        tags: string[]
        images: string[]
        tree: NodeTree | null
        isPublic: boolean
        createdAt: string
    }>) ?? []

    function startEditing(item: { slug: string; title: string; description: string | null; tags?: string[]; images?: string[] }) {
        setEditingId(item.slug)
        setEditTitle(item.title)
        setEditDescription(item.description ?? '')
        setEditContent('')
        setEditTags(item.tags ?? [])
        setEditImages(item.images ?? [])
        setEditContentValid(null)
    }

    function cancelEditing() {
        setEditingId(null)
        setEditTitle('')
        setEditDescription('')
        setEditContent('')
        setEditTags([])
        setEditImages([])
        setEditContentValid(null)
    }

    function saveEditing(slug: string) {
        if (editContent.trim() && editContentValid === false) return
        const payload: Record<string, unknown> = {
            title: editTitle.trim(),
            description: editDescription.trim(),
            tags: editTags,
        }
        if (editContent.trim()) {
            payload.content = editContent.trim()
        }
        payload.images = editImages
        updateMutation.mutate(
            { id: slug, data: payload as never },
            { onSuccess: () => { setEditingId(null); setEditContent(''); setEditContentValid(null) } }
        )
    }

    function handleDelete(slug: string) {
        if (!confirm('Are you sure you want to delete this upload?')) return
        deleteMutation.mutate(slug)
    }

    function handleEditContentChange(value: string) {
        setEditContent(value)
        if (editContentDebounce.current) clearTimeout(editContentDebounce.current)
        if (!value.trim()) {
            setEditContentValid(null)
            setEditContentChecking(false)
            return
        }
        setEditContentChecking(true)
        editContentDebounce.current = setTimeout(async () => {
            try {
                const result = await api.inspect(value.trim())
                const tree = result.tree as Record<string, unknown> | null
                const nodes = tree?.nodes as Record<string, unknown> | undefined
                setEditContentValid(!!nodes && Object.keys(nodes).length > 0)
            } catch {
                setEditContentValid(false)
            }
            setEditContentChecking(false)
        }, 500)
    }

    function handleEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) return
        if (file.size > 2 * 1024 * 1024) return
        if (editImages.length >= 4) return
        const reader = new FileReader()
        reader.onload = () => {
            setEditImages((prev) => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const tabs: { key: Tab; label: string; icon: ReactNode; count?: number }[] = [
        {
            key: 'uploads',
            label: 'Uploads',
            icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
            count: uploads.length,
        },
        {
            key: 'liked',
            label: 'Liked',
            icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
        },
        {
            key: 'saved',
            label: 'Saved',
            icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>,
        },
    ]

    return (
        <div className="mx-auto max-w-4xl px-6 py-12">
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-8">
                <UserAvatar name={user.name ?? user.email} avatarUrl={user.avatarUrl} size="lg" />
                <div>
                    <h1 className="text-xl font-bold">{user.name ?? 'User'}</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">{user.email}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--color-border)] mb-6">
                <div className="flex gap-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${tab === t.key
                                ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                            {t.count !== undefined && (
                                <span className="ml-1 rounded-full bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold">
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            {tab === 'uploads' && (
                <div>
                    {sharesLoading && (
                        <p className="py-8 text-center text-sm text-[var(--color-text-faint)]">Loading...</p>
                    )}
                    {!sharesLoading && uploads.length === 0 && (
                        <div className="py-12 text-center">
                            <svg className="mx-auto h-10 w-10 text-[var(--color-text-faint)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <p className="text-sm text-[var(--color-text-muted)]">You haven't uploaded anything yet.</p>
                            <Link
                                to="/upload"
                                className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)]"
                            >
                                Upload your first tree
                            </Link>
                        </div>
                    )}
                    {!sharesLoading && uploads.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {uploads.map((item) => {
                                const isEditing = editingId === item.slug

                                if (isEditing) {
                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-md border border-[var(--color-accent)] bg-[var(--color-surface)] p-4 sm:col-span-2 lg:col-span-3"
                                        >
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Title</label>
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value.slice(0, 120))}
                                                        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Description</label>
                                                    <textarea
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value.slice(0, 500))}
                                                        className="h-20 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none resize-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Tags</label>
                                                    <TagSelect selected={editTags} onChange={setEditTags} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Images (max 4)</label>
                                                    {editImages.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {editImages.map((img, i) => (
                                                                <div key={i} className="relative">
                                                                    <img src={img} alt={`Image ${i + 1}`} className="h-24 rounded-md border border-[var(--color-border)] object-cover" />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditImages((prev) => prev.filter((_, j) => j !== i))}
                                                                        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-[10px] cursor-pointer"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                    {i === 0 && (
                                                                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white">Cover</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {editImages.length < 4 && (
                                                        <label className="flex h-16 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors">
                                                            <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                {editImages.length === 0 ? 'Choose an image (max 2 MB each)' : 'Add another image'}
                                                            </span>
                                                        </label>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Node tree data</label>
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => handleEditContentChange(e.target.value)}
                                                        placeholder="Paste new node tree data to replace the existing one..."
                                                        className={`h-32 w-full rounded-md border bg-[var(--color-bg)] px-3 py-2 font-mono text-xs focus:outline-none resize-none ${editContent.trim() && editContentValid === false ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'}`}
                                                    />
                                                    {!editContent.trim() && (
                                                        <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">Leave empty to keep existing data</p>
                                                    )}
                                                    {editContent.trim() && editContentChecking && (
                                                        <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">Checking...</p>
                                                    )}
                                                    {editContent.trim() && !editContentChecking && editContentValid === true && (
                                                        <p className="mt-1 text-[10px] text-green-400">✓ Valid node tree data</p>
                                                    )}
                                                    {editContent.trim() && !editContentChecking && editContentValid === false && (
                                                        <p className="mt-1 text-[10px] text-red-400">✗ Could not parse as valid node tree data</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => saveEditing(item.slug)}
                                                        disabled={!editTitle.trim() || updateMutation.isPending || (editContent.trim().length > 0 && editContentValid === false)}
                                                        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-40 cursor-pointer"
                                                    >
                                                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
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
                                            <Link to={`/share/${item.slug}`} className="block min-w-0">
                                                <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                                    {item.title}
                                                </h3>
                                                <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                                                    {item.nodeCount} nodes · {item.linkCount} links · {(() => { const d = new Date(item.createdAt); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}` })()}
                                                </p>
                                            </Link>
                                            <div className="mt-2 flex items-center gap-2">
                                                {item.isPublic ? (
                                                    <span className="text-[10px] text-green-400">Public</span>
                                                ) : (
                                                    <span className="text-[10px] text-[var(--color-text-faint)]">Unlisted</span>
                                                )}
                                                <span className="flex-1" />
                                                <button
                                                    onClick={() => startEditing(item)}
                                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.slug)}
                                                    disabled={deleteMutation.isPending}
                                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
                                                    title="Delete"
                                                >
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    Delete
                                                </button>
                                            </div>
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
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
                    )}
                </div>
            )}

            {tab === 'liked' && (
                <div>
                    {likedLoading && (
                        <p className="py-8 text-center text-sm text-[var(--color-text-faint)]">Loading...</p>
                    )}
                    {!likedLoading && (!likedShares || (likedShares as Array<Record<string, unknown>>).length === 0) && (
                        <div className="py-12 text-center">
                            <svg className="mx-auto h-10 w-10 text-[var(--color-text-faint)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            <p className="text-sm text-[var(--color-text-muted)]">Node trees you like will show up here.</p>
                            <p className="mt-1 text-xs text-[var(--color-text-faint)]">Browse Discover and hit the heart on trees you love.</p>
                        </div>
                    )}
                    {!likedLoading && likedShares && (likedShares as Array<Record<string, unknown>>).length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {(likedShares as Array<{ slug: string; title: string; authorName: string; nodeCount: number; linkCount: number; tags: string[]; images: string[]; tree: NodeTree | null; likes: number; createdAt: string }>).map((item) => (
                                <div
                                    key={item.slug}
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
                                        <Link to={`/share/${item.slug}`} className="block min-w-0">
                                            <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                                {item.title}
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                                                by {item.authorName}
                                            </p>
                                        </Link>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-xs text-red-400">
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                {item.likes}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-faint)]">{item.nodeCount} nodes</span>
                                        </div>
                                        {item.tags && item.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
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
                </div>
            )}

            {tab === 'saved' && (
                <div>
                    {savedLoading && (
                        <p className="py-8 text-center text-sm text-[var(--color-text-faint)]">Loading...</p>
                    )}
                    {!savedLoading && (!savedShares || (savedShares as Array<Record<string, unknown>>).length === 0) && (
                        <div className="py-12 text-center">
                            <svg className="mx-auto h-10 w-10 text-[var(--color-text-faint)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            <p className="text-sm text-[var(--color-text-muted)]">Node trees you bookmark will show up here.</p>
                            <p className="mt-1 text-xs text-[var(--color-text-faint)]">Save trees to come back to them later.</p>
                        </div>
                    )}
                    {!savedLoading && savedShares && (savedShares as Array<Record<string, unknown>>).length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {(savedShares as Array<{ slug: string; title: string; authorName: string; nodeCount: number; linkCount: number; tags: string[]; images: string[]; tree: NodeTree | null; likes: number; createdAt: string }>).map((item) => (
                                <div
                                    key={item.slug}
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
                                        <Link to={`/share/${item.slug}`} className="block min-w-0">
                                            <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--color-accent)] transition-colors truncate">
                                                {item.title}
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                                                by {item.authorName}
                                            </p>
                                        </Link>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                                Saved
                                            </span>
                                            <span className="text-xs text-[var(--color-text-faint)]">{item.nodeCount} nodes</span>
                                        </div>
                                        {item.tags && item.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
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
                </div>
            )}
        </div>
    )
}
