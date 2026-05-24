import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRenderQuota } from '@/hooks/useApi'
import type { NodeFormat } from '@node-runner/shared'

interface HQRenderProps {
    content: string
    format: NodeFormat
    /** Stable id used to revoke object URLs between renders. */
    slug: string
}

function formatResetTime(resetAt: number): string {
    const ms = resetAt - Date.now()
    if (ms <= 0) return 'now'
    const minutes = Math.ceil(ms / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rem = minutes % 60
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

// Button + result for the headless-blender high-quality render.
// Surfaces per-IP quota (renders used + reset time) below the button so users
// can see what they've used; admins see "Unlimited" instead.
export function HQRender({ content, format, slug }: HQRenderProps) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { data: quota } = useRenderQuota()

    const quotaExhausted = quota && !quota.unlimited && quota.used >= quota.limit

    async function handleRender() {
        setBusy(true)
        setError(null)
        // Clear stale image so the user sees the "Rendering" state instead of
        // a broken alt-text box while a slow render is in flight.
        if (imageUrl) {
            URL.revokeObjectURL(imageUrl)
            setImageUrl(null)
        }
        try {
            const token = localStorage.getItem('nr_token')
            const res = await fetch('/api/v1/render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ content, format }),
            })
            if (!res.ok) {
                const ct = res.headers.get('content-type') ?? ''
                if (ct.includes('application/json')) {
                    const body = await res.json() as { error?: { message?: string; code?: string } }
                    throw new Error(body.error?.message ?? `Render failed (HTTP ${res.status})`)
                }
                if (res.status === 504) {
                    throw new Error('Render timed out. Try again - the first render after a server restart takes longer.')
                }
                throw new Error(`Render failed (HTTP ${res.status})`)
            }
            const blob = await res.blob()
            // Defensive: a successful HTTP can still return non-PNG bytes if
            // something upstream went wrong. Validate the type before showing.
            if (!blob.type.startsWith('image/')) {
                throw new Error('Server returned non-image response')
            }
            const url = URL.createObjectURL(blob)
            setImageUrl(url)
            // Pull fresh quota now that this render landed.
            queryClient.invalidateQueries({ queryKey: ['render', 'quota'] })
        } catch (e) {
            setError((e as Error).message || 'Render failed')
        } finally {
            setBusy(false)
        }
    }

    function handleImageError() {
        // The browser failed to decode the blob - revoke and clear so the
        // broken alt-text box doesn't stick around.
        if (imageUrl) URL.revokeObjectURL(imageUrl)
        setImageUrl(null)
        setError('Could not display the rendered image. Try Re-render.')
    }

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">High-quality render</h3>
                <button
                    type="button"
                    onClick={handleRender}
                    disabled={busy || (quotaExhausted && !imageUrl)}
                    title={quotaExhausted ? `Quota exhausted, resets in ${formatResetTime(quota!.resetAt)}` : 'Render this material on a sphere using Blender on the server'}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                    onError={handleImageError}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
            ) : busy ? (
                <div className="flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] aspect-square">
                    <div className="flex flex-col items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Rendering in Blender…
                    </div>
                </div>
            ) : (
                <p className="text-xs text-[var(--color-text-faint)]">
                    Render this material on a sphere with real Blender (Eevee). Takes a few seconds.
                </p>
            )}
            {quota && (
                <p className="mt-2 text-[10px] text-[var(--color-text-faint)]">
                    {quota.unlimited
                        ? 'Admin - unlimited renders'
                        : <>{quota.used} / {quota.limit} renders this hour {quotaExhausted && <span className="text-amber-400">(resets in {formatResetTime(quota.resetAt)})</span>}</>
                    }
                </p>
            )}
        </div>
    )
}
