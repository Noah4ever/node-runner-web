import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/nodeStore'
import { useAuth } from '@/hooks/useApi'

// Official Node Runner logo - same mark as the og-image and favicon.
// Inline SVG so it scales crisply at any size and inherits theme via the
// gradient defined once per render.
function NodeLogo({ className = '' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
                <linearGradient id="nr-logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
            </defs>
            <polygon points="14,32 50,12 50,52" fill="url(#nr-logo-grad)" fillOpacity={0.35} />
            <line x1="14" y1="32" x2="50" y2="12" stroke="url(#nr-logo-grad)" strokeWidth={3} strokeLinecap="round" />
            <line x1="50" y1="12" x2="50" y2="52" stroke="url(#nr-logo-grad)" strokeWidth={3} strokeLinecap="round" />
            <line x1="50" y1="52" x2="14" y2="32" stroke="url(#nr-logo-grad)" strokeWidth={3} strokeLinecap="round" />
            <circle cx="14" cy="32" r="6" fill="url(#nr-logo-grad)" />
            <circle cx="50" cy="12" r="7.5" fill="url(#nr-logo-grad)" />
            <circle cx="50" cy="52" r="6" fill="url(#nr-logo-grad)" />
        </svg>
    )
}

export function RootLayout() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { token } = useAuthStore()
    const { user, logout } = useAuth()
    const [search, setSearch] = useState('')
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [treeMenuOpen, setTreeMenuOpen] = useState(false)
    const [accountMenuOpen, setAccountMenuOpen] = useState(false)
    const treeMenuRef = useRef<HTMLDivElement>(null)
    const accountMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setMobileMenuOpen(false); setTreeMenuOpen(false); setAccountMenuOpen(false) }, [pathname])

    // Close dropdowns on outside click
    useEffect(() => {
        if (!treeMenuOpen && !accountMenuOpen) return
        function onClick(e: MouseEvent) {
            if (treeMenuOpen && treeMenuRef.current && !treeMenuRef.current.contains(e.target as Node)) {
                setTreeMenuOpen(false)
            }
            if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
                setAccountMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [treeMenuOpen, accountMenuOpen])

    const treeMenuActive = pathname === '/convert' || pathname === '/viewer' || pathname === '/editor' || pathname === '/upload'

    function handleSearch(e: React.FormEvent) {
        e.preventDefault()
        if (search.trim()) {
            navigate(`/discover?q=${encodeURIComponent(search.trim())}`)
            setMobileMenuOpen(false)
        }
    }

    // Two secondary destinations. Upload is the primary CTA, separate from these.
    const navLinks = [
        { to: '/discover', label: 'Browse' },
        { to: '/docs', label: 'Docs' },
    ]

    const isLoggedIn = !!token && !!user

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)] sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/85">
                <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
                    {/* Brand */}
                    <Link to="/" className="flex items-center gap-2 shrink-0 text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
                        <NodeLogo className="h-6 w-6" />
                        <span className="text-lg font-bold tracking-tight">Node Runner</span>
                    </Link>

                    {/* Secondary nav - small text links, no icons */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === link.to
                                    ? 'text-[var(--color-text)] bg-[var(--color-surface)]'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        {/* Node Tree dropdown */}
                        <div className="relative" ref={treeMenuRef}>
                            <button
                                type="button"
                                onClick={() => setTreeMenuOpen((o) => !o)}
                                aria-haspopup="menu"
                                aria-expanded={treeMenuOpen}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${treeMenuActive
                                    ? 'text-[var(--color-text)] bg-[var(--color-surface)]'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                                    }`}
                            >
                                Node Tree
                                <svg className={`h-3 w-3 transition-transform ${treeMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {treeMenuOpen && (
                                <div role="menu" className="absolute left-0 top-full mt-1 w-52 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden z-40">
                                    <Link
                                        to="/editor"
                                        role="menuitem"
                                        className={`flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors ${pathname === '/editor' || pathname === '/viewer' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
                                    >
                                        <svg className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        <span className="flex-1">
                                            <span className="block font-medium text-[var(--color-text)]">Editor</span>
                                            <span className="block text-xs text-[var(--color-text-faint)]">Paste, inspect &amp; edit a tree</span>
                                        </span>
                                    </Link>
                                    <Link
                                        to="/convert"
                                        role="menuitem"
                                        className={`flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors ${pathname === '/convert' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
                                    >
                                        <svg className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        <span className="flex-1">
                                            <span className="block font-medium text-[var(--color-text)]">Converter</span>
                                            <span className="block text-xs text-[var(--color-text-faint)]">Hash, JSON, XML, AI JSON</span>
                                        </span>
                                    </Link>
                                    <div className="border-t border-[var(--color-border)]" />
                                    <Link
                                        to="/upload"
                                        role="menuitem"
                                        className={`flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors ${pathname === '/upload' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
                                    >
                                        <svg className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        <span className="flex-1">
                                            <span className="block font-medium text-[var(--color-text)]">Upload</span>
                                            <span className="block text-xs text-[var(--color-text-faint)]">Share a tree with the community</span>
                                        </span>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1" />

                    {/* Search */}
                    <form onSubmit={handleSearch} className="hidden md:block">
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search"
                                aria-label="Search node trees"
                                className="w-44 lg:w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none focus:w-64 transition-[width]"
                            />
                        </div>
                    </form>

                    {/* Primary action - Upload. Visually distinct so a new user knows what to do. */}
                    <Link
                        to="/upload"
                        className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)]"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Upload
                    </Link>

                    {/* Account */}
                    <div className="hidden md:block relative" ref={accountMenuRef}>
                        {isLoggedIn ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setAccountMenuOpen((o) => !o)}
                                    aria-haspopup="menu"
                                    aria-expanded={accountMenuOpen}
                                    aria-label="Account menu"
                                    title={user.name ?? user.email}
                                    className={`inline-flex items-center gap-1 rounded-full pl-0 pr-1.5 transition-colors cursor-pointer ${pathname === '/profile' || accountMenuOpen
                                        ? 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                                        }`}
                                >
                                    <span className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold ${pathname === '/profile' || accountMenuOpen
                                        ? 'bg-[var(--color-accent)] text-black'
                                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                                        }`}>
                                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                                    </span>
                                    <svg className={`h-3 w-3 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {accountMenuOpen && (
                                    <div role="menu" className="absolute right-0 top-full mt-1 w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden z-40">
                                        <Link
                                            to="/profile"
                                            role="menuitem"
                                            className="block px-3 py-2 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                                        >
                                            <p className="text-sm font-medium text-[var(--color-text)] truncate">{user.name ?? 'Signed in'}</p>
                                            <p className="text-xs text-[var(--color-text-faint)] truncate">{user.email}</p>
                                        </Link>
                                        <Link
                                            to="/profile"
                                            role="menuitem"
                                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
                                        >
                                            <svg className="h-4 w-4 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Profile
                                        </Link>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => { setAccountMenuOpen(false); logout() }}
                                            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-red-400 transition-colors cursor-pointer text-left border-t border-[var(--color-border)]"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <Link
                                to="/signin"
                                className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                            >
                                Sign in
                            </Link>
                        )}
                    </div>

                    {/* Mobile: primary CTA + hamburger */}
                    <Link
                        to="/upload"
                        aria-label="Upload"
                        className="md:hidden flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent)] text-black"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </Link>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                        className="md:hidden flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                        {mobileMenuOpen ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>
                </nav>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-4 py-4 space-y-3">
                        <form onSubmit={handleSearch}>
                            <div className="relative">
                                <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search node trees"
                                    aria-label="Search node trees"
                                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                                />
                            </div>
                        </form>

                        <div className="flex flex-col">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === link.to ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="mt-2 px-3 text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">Node Tree</div>
                            <Link
                                to="/editor"
                                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === '/editor' || pathname === '/viewer' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}
                            >
                                Editor
                            </Link>
                            <Link
                                to="/convert"
                                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === '/convert' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}
                            >
                                Converter
                            </Link>
                        </div>

                        <div className="border-t border-[var(--color-border)] pt-3">
                            {isLoggedIn ? (
                                <div className="flex items-center justify-between">
                                    <Link to="/profile" className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs">
                                            {(user.name ?? user.email).charAt(0).toUpperCase()}
                                        </span>
                                        {user.name ?? user.email}
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] transition-colors cursor-pointer"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/signin"
                                    className="flex w-full items-center justify-center rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors"
                                >
                                    Sign in
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t border-[var(--color-border-subtle)] py-6 sm:py-8 text-center text-sm text-[var(--color-text-faint)]">
                Node Runner &middot; A Blender add-on &middot;{' '}
                <a
                    href="https://extensions.blender.org/add-ons/node-runner/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                    Blender Add-on
                </a>
                {' '}&middot;{' '}
                <a
                    href="https://github.com/Noah4ever/node_runner"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                    GitHub
                </a>
                {' '}&middot;{' '}
                <Link to="/privacy" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Privacy</Link>
                {' '}&middot;{' '}
                <Link to="/terms" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Terms</Link>
            </footer>
        </div>
    )
}
