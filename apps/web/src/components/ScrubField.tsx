import { useCallback, useEffect, useRef, useState } from 'react'

interface ScrubFieldProps {
    value: number
    onChange: (next: number) => void
    /** Float step per pixel of drag. Defaults to 0.01 for floats, overridden to 1 for ints. */
    step?: number
    /** When true, value is rounded to integers on each tick and on commit. */
    integer?: boolean
    min?: number
    max?: number
    /** Optional precision for the displayed value (decimals). */
    precision?: number
    /** Hint label shown small to the left of the value, e.g. socket name. */
    label?: string
    className?: string
}

const CLICK_THRESHOLD_PX = 4
const CLICK_THRESHOLD_MS = 200

// Blender-style numeric field:
//  - mousedown + drag horizontally to scrub the value
//  - hold Shift while dragging for fine control (0.1x)
//  - hold Ctrl/Cmd while dragging for coarse control (10x)
//  - click without dragging to enter a text editor; Enter commits, Esc reverts
//
// The component captures the pointer on press so the cursor can leave the
// element without losing tracking, matching the native-tool feel.
export function ScrubField({
    value,
    onChange,
    step,
    integer = false,
    min,
    max,
    precision = 3,
    label,
    className = '',
}: ScrubFieldProps) {
    const [editing, setEditing] = useState(false)
    const [draftText, setDraftText] = useState('')
    const [isScrubbing, setIsScrubbing] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)

    // While scrubbing we track the starting value + cursor x so dx is always
    // relative to the press point, not the previous frame.
    const scrubState = useRef<{
        startX: number
        startY: number
        startValue: number
        startedAt: number
        moved: boolean
    } | null>(null)

    const effectiveStep = step ?? (integer ? 1 : 0.01)

    const clamp = useCallback((v: number) => {
        let n = v
        if (typeof min === 'number') n = Math.max(min, n)
        if (typeof max === 'number') n = Math.min(max, n)
        if (integer) n = Math.round(n)
        return n
    }, [min, max, integer])

    function format(v: number): string {
        if (integer) return String(Math.round(v))
        // Trim trailing zeros so 0.5 doesn't show as 0.500
        return v.toFixed(precision).replace(/0+$/, '').replace(/\.$/, '')
    }

    function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if (editing) return
        // Only left-button
        if (e.button !== 0) return
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        scrubState.current = {
            startX: e.clientX,
            startY: e.clientY,
            startValue: value,
            startedAt: performance.now(),
            moved: false,
        }
        setIsScrubbing(true)
    }

    function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const s = scrubState.current
        if (!s) return
        const dx = e.clientX - s.startX
        const dy = e.clientY - s.startY
        if (!s.moved && Math.hypot(dx, dy) < CLICK_THRESHOLD_PX) return
        s.moved = true
        // Sensitivity modifiers - shift = fine, ctrl/meta = coarse
        const mult = e.shiftKey ? 0.1 : (e.ctrlKey || e.metaKey ? 10 : 1)
        const next = clamp(s.startValue + dx * effectiveStep * mult)
        if (next !== value) onChange(next)
    }

    function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
        const s = scrubState.current
        scrubState.current = null
        setIsScrubbing(false)
        if (!s) return
        ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
        // Click without scrub -> enter text edit mode
        const elapsed = performance.now() - s.startedAt
        if (!s.moved && elapsed < CLICK_THRESHOLD_MS) {
            setDraftText(format(value))
            setEditing(true)
        }
    }

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus()
            inputRef.current?.select()
        }
    }, [editing])

    function commitText() {
        const n = parseFloat(draftText)
        if (!Number.isFinite(n)) {
            setEditing(false)
            return
        }
        onChange(clamp(n))
        setEditing(false)
    }

    function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            commitText()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setEditing(false)
        }
    }

    if (editing) {
        return (
            <div className={`flex items-center gap-1.5 nodrag nr-noselect ${className}`} onClick={(e) => e.stopPropagation()}>
                {label && <span style={{ color: '#a0a0a0', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={commitText}
                    onKeyDown={handleKey}
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #4a4a4a',
                        borderRadius: 2,
                        color: '#fff',
                        fontSize: 10,
                        padding: '0 4px',
                        width: 60,
                        textAlign: 'right',
                        fontFamily: 'inherit',
                        fontVariantNumeric: 'tabular-nums',
                        outline: 'none',
                    }}
                />
            </div>
        )
    }

    return (
        <div
            role="slider"
            tabIndex={0}
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => e.stopPropagation()}
            className={`select-none nodrag nr-noselect ${className}`}
            style={{
                cursor: isScrubbing ? 'ew-resize' : 'col-resize',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                userSelect: 'none',
                touchAction: 'none',
            }}
            title="Drag horizontally to scrub. Shift = fine, Ctrl/Cmd = coarse. Click to type."
        >
            {label && <span style={{ color: '#a0a0a0', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
            <span
                style={{
                    color: '#e5e5e5',
                    fontSize: 10,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                }}
            >
                {format(value)}
            </span>
        </div>
    )
}
