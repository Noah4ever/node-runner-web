import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useApi'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

function getOrCreateDeviceSecret(): string {
    const key = 'nr_device_secret'
    let secret = localStorage.getItem(key)
    if (!secret) {
        const bytes = new Uint8Array(32)
        crypto.getRandomValues(bytes)
        secret = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
        localStorage.setItem(key, secret)
    }
    return secret
}

const OAUTH_ERRORS: Record<string, string> = {
    oauth_denied: 'Sign in was cancelled.',
    invalid_state: 'Session expired. Please try again.',
    token_exchange: 'Could not connect to provider. Please try again.',
    user_info: 'Could not get your profile. Please try again.',
    oauth_failed: 'Something went wrong. Please try again.',
    banned: 'This account has been banned.',
    not_configured: 'This sign-in method is not configured.',
}

export function SignInPage() {
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const { login, isLoggedIn, user } = useAuth()
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { data: providerData } = useQuery({
        queryKey: ['auth', 'providers'],
        queryFn: () => api.providers(),
    })
    const providers = providerData?.providers ?? ['device']

    useEffect(() => {
        const oauthError = params.get('error')
        if (oauthError) {
            setError(OAUTH_ERRORS[oauthError] ?? 'Something went wrong.')
        }
    }, [params])

    if (isLoggedIn && user) {
        return (
            <div className="mx-auto max-w-md px-6 py-24 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    Signed in as {(user as Record<string, unknown>).name as string ?? (user as Record<string, unknown>).email as string}
                </p>
                <button
                    onClick={() => navigate('/profile')}
                    className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] cursor-pointer"
                >
                    Go to Profile
                </button>
            </div>
        )
    }

    async function handleUsernameSubmit(e: React.FormEvent) {
        e.preventDefault()
        const name = username.trim()
        if (!name) return

        setLoading(true)
        setError('')
        try {
            const deviceSecret = getOrCreateDeviceSecret()
            await login({
                provider: 'device',
                email: `${deviceSecret.slice(0, 16)}@device.local`,
                providerId: deviceSecret,
                name,
            })
            navigate('/profile')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const hasOAuth = providers.includes('google') || providers.includes('github')

    return (
        <div className="mx-auto max-w-md px-6 py-24">
            <h1 className="text-2xl font-bold text-center">Sign In</h1>
            <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
                Sign in to upload and manage your shared node trees.
            </p>

            <div className="mt-10 space-y-6">
                {error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* OAuth providers */}
                {hasOAuth && (
                    <div className="space-y-3">
                        {providers.includes('google') && (
                            <a
                                href="/api/v1/auth/google"
                                className="flex w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </a>
                        )}

                        {providers.includes('github') && (
                            <a
                                href="/api/v1/auth/github"
                                className="flex w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                            >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                                </svg>
                                Continue with GitHub
                            </a>
                        )}
                    </div>
                )}

                {/* Divider */}
                {hasOAuth && (
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--color-border)]" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-[var(--color-bg)] px-3 text-[var(--color-text-faint)]">or continue with username</span>
                        </div>
                    </div>
                )}

                {/* Username login */}
                <form onSubmit={handleUsernameSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium mb-1.5">Choose a username</label>
                        <input
                            id="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30))}
                            placeholder="your_username"
                            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-mono placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                            autoFocus={!hasOAuth}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !username.trim()}
                        className="w-full rounded-md bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40 cursor-pointer"
                    >
                        {loading ? 'Creating account...' : 'Continue with username'}
                    </button>
                </form>

                {/* Info box */}
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
                    {hasOAuth && (
                        <p className="text-xs text-[var(--color-text-faint)] leading-relaxed">
                            <strong className="text-[var(--color-text-muted)]">Google / GitHub</strong> — your account works across devices and browsers.
                        </p>
                    )}
                    <p className="text-xs text-[var(--color-text-faint)] leading-relaxed">
                        <strong className="text-[var(--color-text-muted)]">Username only</strong> — quick and easy, but tied to this browser. No cross-device access.
                    </p>
                </div>
            </div>
        </div>
    )
}
