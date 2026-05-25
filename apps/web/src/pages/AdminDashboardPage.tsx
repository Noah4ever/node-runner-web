import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth, useDeleteShare } from '@/hooks/useApi'
import { LICENSE_INFO, type NodeLicense } from '@node-runner/shared'

interface AdminShareRow {
    id: string
    slug: string
    title: string
    description: string | null
    format: string
    isPublic: boolean
    nodeCount: number
    linkCount: number
    tags: string[]
    license?: NodeLicense
    authorId: string | null
    authorName: string
    imageCount: number
    likes: number
    createdAt: string
    updatedAt: string
}

type Tab = 'shares' | 'users' | 'stats'

function fmtDate(s: string): string {
    try {
        const d = new Date(s)
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
        return s
    }
}

export function AdminDashboardPage() {
    const navigate = useNavigate()
    const { user, isLoading: authLoading } = useAuth()
    const [tab, setTab] = useState<Tab>('shares')
    const [search, setSearch] = useState('')
    const qc = useQueryClient()

    const sharesQuery = useQuery({
        queryKey: ['admin', 'shares'],
        queryFn: () => api.adminListShares() as unknown as Promise<AdminShareRow[]>,
        enabled: !!user?.isAdmin,
    })
    const usersQuery = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => api.adminListUsers(),
        enabled: !!user?.isAdmin,
    })
    const statsQuery = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => api.adminStats(),
        enabled: !!user?.isAdmin,
    })

    const deleteMut = useDeleteShare()
    const banMut = useMutation({
        mutationFn: (userId: string) => api.adminBan(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    })
    const unbanMut = useMutation({
        mutationFn: (userId: string) => api.adminUnban(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    })

    if (authLoading) {
        return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--color-text-faint)]">Loading…</div>
    }

    if (!user?.isAdmin) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-12 text-center">
                <h1 className="text-xl font-bold">Admin only</h1>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    You don't have access to this page.{' '}
                    {!user && (
                        <Link to="/signin" className="text-[var(--color-accent)] hover:underline">Sign in</Link>
                    )}
                </p>
            </div>
        )
    }

    const shares = sharesQuery.data ?? []
    const filteredShares = search
        ? shares.filter((s) => (
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.authorName.toLowerCase().includes(search.toLowerCase()) ||
            s.slug.toLowerCase().includes(search.toLowerCase()) ||
            (s.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
        ))
        : shares
    const users = usersQuery.data ?? []
    const filteredUsers = search
        ? users.filter((u) => (
            (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            u.id.toLowerCase().includes(search.toLowerCase())
        ))
        : users
    const stats = statsQuery.data

    function handleDelete(slug: string, title: string) {
        if (!confirm(`Delete "${title}"? This can't be undone.`)) return
        deleteMut.mutate(slug, {
            onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
        })
    }

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold">Admin dashboard</h1>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">All shares and users.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                    />
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
                    <StatCard label="Shares" value={stats.shares} />
                    <StatCard label="Public" value={stats.publicShares} />
                    <StatCard label="Users" value={stats.users} />
                    <StatCard label="Banned" value={stats.bannedUsers} />
                    <StatCard label="Total likes" value={stats.totalLikes} />
                </div>
            )}

            <div className="flex border-b border-[var(--color-border)] mb-4" role="tablist">
                <TabBtn id="shares" active={tab} onClick={setTab}>Shares ({shares.length})</TabBtn>
                <TabBtn id="users" active={tab} onClick={setTab}>Users ({users.length})</TabBtn>
                <TabBtn id="stats" active={tab} onClick={setTab}>Stats</TabBtn>
            </div>

            {tab === 'shares' && (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--color-bg)] text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
                                <tr>
                                    <th className="text-left px-3 py-2">Title</th>
                                    <th className="text-left px-3 py-2">Author</th>
                                    <th className="text-left px-3 py-2 hidden md:table-cell">Format</th>
                                    <th className="text-left px-3 py-2 hidden md:table-cell">License</th>
                                    <th className="text-right px-3 py-2 hidden sm:table-cell">Nodes</th>
                                    <th className="text-right px-3 py-2 hidden sm:table-cell">Likes</th>
                                    <th className="text-left px-3 py-2 hidden lg:table-cell">Created</th>
                                    <th className="text-right px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {sharesQuery.isLoading && (
                                    <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-[var(--color-text-faint)]">Loading…</td></tr>
                                )}
                                {!sharesQuery.isLoading && filteredShares.length === 0 && (
                                    <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-[var(--color-text-faint)]">No shares match.</td></tr>
                                )}
                                {filteredShares.map((s) => (
                                    <tr key={s.id} className="hover:bg-[var(--color-surface-hover)]">
                                        <td className="px-3 py-2">
                                            <Link to={`/share/${s.slug}`} className="font-medium hover:text-[var(--color-accent)]">{s.title}</Link>
                                            {!s.isPublic && <span className="ml-2 text-[9px] uppercase rounded bg-amber-500/15 px-1 py-0.5 text-amber-400">Private</span>}
                                        </td>
                                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.authorName}</td>
                                        <td className="px-3 py-2 text-[var(--color-text-muted)] hidden md:table-cell">{s.format}</td>
                                        <td className="px-3 py-2 text-[var(--color-text-muted)] hidden md:table-cell">{s.license && LICENSE_INFO[s.license] ? LICENSE_INFO[s.license].short : '—'}</td>
                                        <td className="px-3 py-2 text-right text-[var(--color-text-muted)] hidden sm:table-cell">{s.nodeCount}</td>
                                        <td className="px-3 py-2 text-right text-[var(--color-text-muted)] hidden sm:table-cell">{s.likes}</td>
                                        <td className="px-3 py-2 text-[var(--color-text-faint)] text-xs hidden lg:table-cell">{fmtDate(s.createdAt)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="inline-flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/share/${s.slug}`)}
                                                    className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] cursor-pointer"
                                                    title="Open share"
                                                >Open</button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(s.slug, s.title)}
                                                    className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                                                >Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'users' && (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--color-bg)] text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
                                <tr>
                                    <th className="text-left px-3 py-2">Name</th>
                                    <th className="text-left px-3 py-2">Email</th>
                                    <th className="text-left px-3 py-2 hidden md:table-cell">Provider</th>
                                    <th className="text-left px-3 py-2 hidden lg:table-cell">Joined</th>
                                    <th className="text-left px-3 py-2">Status</th>
                                    <th className="text-right px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {usersQuery.isLoading && (
                                    <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-[var(--color-text-faint)]">Loading…</td></tr>
                                )}
                                {!usersQuery.isLoading && filteredUsers.length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-[var(--color-text-faint)]">No users match.</td></tr>
                                )}
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-[var(--color-surface-hover)]">
                                        <td className="px-3 py-2">
                                            <Link to={`/user/${u.id}`} className="font-medium hover:text-[var(--color-accent)]">{u.name || '(no name)'}</Link>
                                        </td>
                                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{u.email}</td>
                                        <td className="px-3 py-2 text-[var(--color-text-muted)] hidden md:table-cell">{u.provider}</td>
                                        <td className="px-3 py-2 text-[var(--color-text-faint)] text-xs hidden lg:table-cell">{fmtDate(u.createdAt)}</td>
                                        <td className="px-3 py-2">
                                            {u.banned ? (
                                                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">Banned</span>
                                            ) : (
                                                <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-400">Active</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {u.banned ? (
                                                <button
                                                    type="button"
                                                    onClick={() => unbanMut.mutate(u.id)}
                                                    disabled={unbanMut.isPending}
                                                    className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] cursor-pointer disabled:opacity-50"
                                                >Unban</button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => { if (confirm(`Ban ${u.name || u.email}? Their session is killed immediately.`)) banMut.mutate(u.id) }}
                                                    disabled={banMut.isPending}
                                                    className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                                                >Ban</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'stats' && stats && (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <dt className="text-[var(--color-text-muted)]">Total shares</dt>
                        <dd className="text-right font-mono">{stats.shares}</dd>
                        <dt className="text-[var(--color-text-muted)]">Public shares</dt>
                        <dd className="text-right font-mono">{stats.publicShares}</dd>
                        <dt className="text-[var(--color-text-muted)]">Private shares</dt>
                        <dd className="text-right font-mono">{stats.shares - stats.publicShares}</dd>
                        <dt className="text-[var(--color-text-muted)]">Registered users</dt>
                        <dd className="text-right font-mono">{stats.users}</dd>
                        <dt className="text-[var(--color-text-muted)]">Banned users</dt>
                        <dd className="text-right font-mono">{stats.bannedUsers}</dd>
                        <dt className="text-[var(--color-text-muted)]">Total likes</dt>
                        <dd className="text-right font-mono">{stats.totalLikes}</dd>
                    </dl>
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">{label}</div>
            <div className="text-xl font-bold font-mono">{value}</div>
        </div>
    )
}

function TabBtn({ id, active, onClick, children }: { id: Tab; active: Tab; onClick: (t: Tab) => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={() => onClick(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${active === id ? 'text-[var(--color-text)] border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text)]'}`}
        >
            {children}
        </button>
    )
}
