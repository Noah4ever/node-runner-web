import { useState } from 'react'

export function DiffPage() {
    const [left, setLeft] = useState('')
    const [right, setRight] = useState('')

    return (
        <div className="mx-auto max-w-5xl px-6 py-12">
            <h1 className="text-2xl font-bold">Compare</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Compare two node trees and see what changed.
            </p>

            {/* Inputs */}
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Left (Original)</label>
                    <textarea
                        value={left}
                        onChange={(e) => setLeft(e.target.value)}
                        placeholder="Paste first node tree..."
                        className="h-44 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Right (Modified)</label>
                    <textarea
                        value={right}
                        onChange={(e) => setRight(e.target.value)}
                        placeholder="Paste second node tree..."
                        className="h-44 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                    />
                </div>
            </div>

            <div className="mt-4">
                <button
                    disabled={!left.trim() || !right.trim()}
                    className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
                >
                    Compare
                </button>
            </div>

            {/* Diff Results */}
            <div className="mt-10 space-y-6">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Summary</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Run a comparison to see the diff summary.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <h4 className="text-xs text-[var(--color-text-faint)]">Changed Nodes</h4>
                        <p className="mt-1 text-xl font-semibold">-</p>
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <h4 className="text-xs text-[var(--color-text-faint)]">Changed Values</h4>
                        <p className="mt-1 text-xl font-semibold">-</p>
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <h4 className="text-xs text-[var(--color-text-faint)]">Changed Links</h4>
                        <p className="mt-1 text-xl font-semibold">-</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
