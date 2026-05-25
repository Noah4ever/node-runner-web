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

// Used to pace the fake progress bar. Software-rendered Eevee on the
// headless server varies wildly with shader complexity (simple metals
// land sub-10s, high-detail noise + transmission can hit 1-2 minutes).
// We pick a middle expected duration; bar tweens to 0.95 over this period.
const EXPECTED_FRESH_MS = 45_000

export function HQRender({ content, format, slug }: HQRenderProps) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [shape, setShape] = useState<Shape>('sphere')
    const [progress, setProgress] = useState(0) // 0..1
    const [elapsedMs, setElapsedMs] = useState(0)
    const queryClient = useQueryClient()
    const { data: quota } = useRenderQuota()
    const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    const quotaExhausted = quota && !quota.unlimited && quota.used >= quota.limit

    // Drive the fake progress bar AND the elapsed-time counter. The bar
    // tweens to 0.95 over EXPECTED_FRESH_MS; the elapsed timer ticks every
    // 100ms so the user sees something accurate even when our estimate is
    // off (which it often will be).
    useEffect(() => {
        if (!busy) {
            if (progressTimer.current) clearInterval(progressTimer.current)
            progressTimer.current = null
            return
        }
        const start = performance.now()
        const expected = EXPECTED_FRESH_MS
        setElapsedMs(0)
        progressTimer.current = setInterval(() => {
            const elapsed = performance.now() - start
            setElapsedMs(elapsed)
            const t = elapsed / expected
            const p = 1 - Math.exp(-t * 1.5)
            setProgress(Math.min(0.95, p * 0.95))
        }, 100)
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

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">High-quality render</h3>
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wider">Beta</span>
                </div>
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

            {/* Progress bar + elapsed timer. Bar is estimated (no progress
                channel from blender) but the timer is real. */}
            {busy && (
                <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-text-faint)] mb-1">
                        <span>Rendering…</span>
                        <span className="font-mono tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg)] overflow-hidden">
                        <div
                            className="h-full bg-[var(--color-accent)] transition-[width] duration-100 ease-linear"
                            style={{ width: `${(progress * 100).toFixed(1)}%` }}
                        />
                    </div>
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
                            <span className="text-xs font-mono tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-faint)] py-2">
                        Pick an object and click Render.
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
