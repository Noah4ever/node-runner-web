import { useState } from 'react'
import type { NodeFormat } from '@node-runner/shared'

interface HQRenderProps {
    content: string
    format: NodeFormat
    /** Stable id used to revoke object URLs between renders. */
    slug: string
}

// Button + result for the headless-blender high-quality render. Wraps the
// `POST /api/v1/render` endpoint. Holds the result in an object URL so we
// don't keep base64 in state.
export function HQRender({ content, format, slug }: HQRenderProps) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    async function handleRender() {
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/v1/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, format }),
            })
            if (!res.ok) {
                // Server returns JSON for errors and PNG for success - sniff the type.
                const ct = res.headers.get('content-type') ?? ''
                if (ct.includes('application/json')) {
                    const body = await res.json() as { error?: { message?: string; code?: string } }
                    throw new Error(body.error?.message ?? `Render failed (HTTP ${res.status})`)
                }
                throw new Error(`Render failed (HTTP ${res.status})`)
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            if (imageUrl) URL.revokeObjectURL(imageUrl)
            setImageUrl(url)
        } catch (e) {
            setError((e as Error).message || 'Render failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">High-quality render</h3>
                <button
                    type="button"
                    onClick={handleRender}
                    disabled={busy}
                    title="Render this material on a sphere using Blender on the server"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 cursor-pointer"
                >
                    {busy ? (
                        <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Rendering</>
                    ) : imageUrl ? 'Re-render' : 'Render'}
                </button>
            </div>
            {error && (
                <p role="alert" className="mb-2 text-xs text-red-400">{error}</p>
            )}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={`Rendered preview of ${slug}`}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
            ) : (
                <p className="text-xs text-[var(--color-text-faint)]">
                    Render this material on a sphere with real Blender (Eevee). Takes a few seconds. Limited to 6 renders per hour per IP.
                </p>
            )}
        </div>
    )
}
