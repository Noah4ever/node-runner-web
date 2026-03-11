import { Link } from 'react-router-dom'

export function NotFoundPage() {
    return (
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center px-6 py-32 text-center">
            <h1 className="text-5xl font-bold text-[var(--color-text-faint)]">404</h1>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                This page doesn't exist.
            </p>
            <Link
                to="/"
                className="mt-6 rounded-md border border-[var(--color-border)] px-5 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]"
            >
                Go home
            </Link>
        </div>
    )
}
