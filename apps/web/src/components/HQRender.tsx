import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRenderQuota } from '@/hooks/useApi'
import type { NodeFormat } from '@node-runner/shared'

interface HQRenderProps {
    content: string
    format: NodeFormat
    slug: string
}

type Shape = 'sphere' | 'cube' | 'plane' | 'cylinder' | 'torus' | 'monkey'
const SHAPES: { id: Shape; label: string }[] = [
    { id: 'sphere', label: 'Sphere' },
    { id: 'cube', label: 'Cube' },
    { id: 'plane', label: 'Plane' },
    { id: 'cylinder', label: 'Cylinder' },
    { id: 'torus', label: 'Torus' },
    { id: 'monkey', label: 'Suzanne' },
]

function formatResetTime(resetAt: number): string {
    const ms = resetAt - Date.now()
    if (ms <= 0) return 'now'
    const minutes = Math.ceil(ms / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rem = minutes % 60
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

// Estimated render durations (sec) - used to drive the progress bar speed.
// First fresh render of a server-cold-start takes ~30-50s; subsequent ones
// are much faster. Cached returns near-instant. We don't have a true
// progress channel from blender, so the bar fakes it up to 95% over the
// expected time then snaps to 100% on completion.
const EXPECTED_FRESH_MS = 35_000
const EXPECTED_CACHED_MS = 800

export function HQRender({ content, format, slug }: HQRenderProps) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [shape, setShape] = useState<Shape>('sphere')
    const [progress, setProgress] = useState(0) // 0..1
    const queryClient = useQueryClient()
    const { data: quota } = useRenderQuota()
    const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    const quotaExhausted = quota && !quota.unlimited && quota.used >= quota.limit

    // Drive the fake progress bar at request time. We assume an expected
    // duration and tween toward 0.95 logarithmically so the bar slows down
    // near the end - feels more honest than a linear race.
    useEffect(() => {
        if (!busy) {
            if (progressTimer.current) clearInterval(progressTimer.current)
            progressTimer.current = null
            return
        }
        const start = performance.now()
        const expected = EXPECTED_FRESH_MS
        progressTimer.current = setInterval(() => {
            const elapsed = performance.now() - start
            // Eases toward 0.95; never reaches there exactly.
            const t = elapsed / expected
            const p = 1 - Math.exp(-t * 1.5)
            setProgress(Math.min(0.95, p * 0.95))
        }, 80)
        return () => {
            if (progressTimer.current) clearInterval(progressTimer.current)
            progressTimer.current = null
        }
    }, [busy])

    async function handleRender() {
        setBusy(true)
        setError(null)
        setProgress(0)
        try {
            const token = localStorage.getItem('nr_token')
            const res = await fetch('/api/v1/render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ content, format, shape }),
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
            if (!blob.type.startsWith('image/')) {
                throw new Error('Server returned non-image response')
            }
            // Don't revoke the previous image until the new one is ready - the
            // <img> swap is atomic so users don't see a flicker.
            const oldUrl = imageUrl
            const url = URL.createObjectURL(blob)
            setImageUrl(url)
            setProgress(1)
            if (oldUrl) {
                // Defer revoke a tick so the new <img> has time to attach.
                setTimeout(() => URL.revokeObjectURL(oldUrl), 100)
            }
            queryClient.invalidateQueries({ queryKey: ['render', 'quota'] })
        } catch (e) {
            setError((e as Error).message || 'Render failed')
            setProgress(0)
        } finally {
            setBusy(false)
        }
    }

    function handleImageError() {
        if (imageUrl) URL.revokeObjectURL(imageUrl)
        setImageUrl(null)
        setError('Could not display the rendered image. Try Re-render.')
    }

    // Show how long the current render has been running so the user knows
    // it's still working during the cold-start window.
    const expectedSec = imageUrl ? EXPECTED_CACHED_MS / 1000 : EXPECTED_FRESH_MS / 1000

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">High-quality render</h3>
                <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value as Shape)}
                    disabled={busy}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text)] cursor-pointer focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
                    title="Object to render"
                >
                    {SHAPES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                </select>
            </div>

            <button
                type="button"
                onClick={handleRender}
                disabled={busy || (quotaExhausted && !imageUrl)}
                title={quotaExhausted ? `Quota exhausted, resets in ${formatResetTime(quota!.resetAt)}` : 'Render this material on the chosen object via Blender (Eevee)'}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
                {busy ? 'Rendering…' : imageUrl ? 'Re-render' : 'Render'}
            </button>

            {/* Progress bar - estimated since blender's stdout isn't parsed. */}
            {busy && (
                <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg)] overflow-hidden">
                        <div
                            className="h-full bg-[var(--color-accent)] transition-[width] duration-100 ease-linear"
                            style={{ width: `${(progress * 100).toFixed(1)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--color-text-faint)] text-center">
                        Rendering in Blender (Eevee) - expect ~{Math.round(expectedSec)}s on a cold server
                    </p>
                </div>
            )}

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>
            )}

            <div className="mt-2">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`Rendered preview of ${slug}`}
                        onError={handleImageError}
                        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                    />
                ) : busy ? (
                    <div className="flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] aspect-square">
                        <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                            <SpinnerArc />
                            <span className="text-xs">Rendering…</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-faint)] py-2">
                        Pick an object and click Render. Takes a few seconds; first render after a restart is slower.
                    </p>
                )}
            </div>

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

// Clockwise-rotating quarter-arc spinner. The default tailwind `animate-spin`
// on the refresh-arrow icon visually reads as anti-clockwise because the
// icon's hook points one way. A symmetric arc avoids that ambiguity.
function SpinnerArc() {
    return (
        <svg className="h-8 w-8 animate-spin text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
            <path d="M21 12 a 9 9 0 0 0 -9 -9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}
