import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useApi'

export function AdminLoginPage() {
    const navigate = useNavigate()
    const { adminLogin, isLoggedIn, user } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (isLoggedIn && user) {
        return (
            <div className="mx-auto max-w-md px-6 py-24 text-center">
                <h1 className="text-2xl font-bold">Already signed in</h1>
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

    return (
        <div className="mx-auto max-w-sm px-6 py-24">
            <h1 className="text-xl font-bold text-center">Admin Login</h1>

            <form
                onSubmit={async (e) => {
                    e.preventDefault()
                    if (!email.trim() || !password.trim()) return
                    setLoading(true)
                    setError('')
                    try {
                        await adminLogin({ email: email.trim(), password })
                        navigate('/profile')
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Invalid credentials.')
                    } finally {
                        setLoading(false)
                    }
                }}
                className="mt-8 space-y-4"
            >
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                    autoFocus
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                    type="submit"
                    disabled={loading || !email.trim() || !password.trim()}
                    className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40 cursor-pointer"
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
        </div>
    )
}
