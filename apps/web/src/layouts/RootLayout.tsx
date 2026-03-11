import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/nodeStore'
import { useAuth } from '@/hooks/useApi'

export function RootLayout() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { token } = useAuthStore()
    const { user, logout } = useAuth()
    const [search, setSearch] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // Close mobile menu on navigation
    useEffect(() => { setMobileMenuOpen(false) }, [pathname])

    function handleSearch(e: React.FormEvent) {
        e.preventDefault()
        if (search.trim()) {
            navigate(`/discover?q=${encodeURIComponent(search.trim())}`)
            setMobileMenuOpen(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]">
                <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
                    <Link to="/" className="text-lg font-bold tracking-tight text-[var(--color-text)] shrink-0">
                        Node Runner
                    </Link>

                    <div className="flex-1" />

                    {/* Search bar — desktop only */}
                    <form onSubmit={handleSearch} className={`hidden md:block transition-all duration-200 ${searchFocused ? 'flex-1 max-w-md' : 'w-48'}`}>
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                placeholder="Search node trees..."
                                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                            />
                        </div>
                    </form>

                    {/* Desktop nav links */}
                    <div className="hidden md:flex items-center gap-5">
                        <Link
                            to="/discover"
                            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${pathname === '/discover'
                                ? 'text-[var(--color-text)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            Discover
                        </Link>
                        <Link
                            to="/upload"
                            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${pathname === '/upload'
                                ? 'text-[var(--color-text)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Upload
                        </Link>
                        <Link
                            to="/docs"
                            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${pathname === '/docs'
                                ? 'text-[var(--color-text)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            Docs
                        </Link>

                        <div className="h-5 w-px bg-[var(--color-border)]" />

                        {token && user ? (
                            <div className="flex items-center gap-3">
                                <Link
                                    to="/profile"
                                    className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${pathname === '/profile'
                                        ? 'text-[var(--color-text)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                        }`}
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    {user.name ?? user.email}
                                </Link>
                                <button
                                    onClick={() => logout()}
                                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] transition-colors cursor-pointer"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    Sign out
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/signin"
                                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-hover)]"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-4l5-5-5-5m5 5H3" /></svg>
                                Sign in
                            </Link>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
                        {/* Mobile search */}
                        <form onSubmit={handleSearch}>
                            <div className="relative">
                                <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search node trees..."
                                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                                />
                            </div>
                        </form>

                        {/* Mobile nav links */}
                        <div className="flex flex-col gap-1">
                            <Link to="/discover" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === '/discover' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                Discover
                            </Link>
                            <Link to="/upload" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === '/upload' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Upload
                            </Link>
                            <Link to="/docs" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${pathname === '/docs' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                Docs
                            </Link>
                        </div>

                        <div className="border-t border-[var(--color-border)] pt-3">
                            {token && user ? (
                                <div className="flex items-center justify-between">
                                    <Link to="/profile" className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
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
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-hover)]"
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
