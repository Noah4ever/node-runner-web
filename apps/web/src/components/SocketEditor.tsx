import { ScrubField } from './ScrubField'

interface BaseProps {
    label?: string
    onChange: (next: unknown) => void
    /** className passed to the outer wrapper for layout overrides. */
    className?: string
}

type EditorProps = BaseProps & (
    | { kind: 'number'; value: number }
    | { kind: 'bool'; value: boolean }
    | { kind: 'string'; value: string }
    | { kind: 'color'; value: number[] }
    | { kind: 'vector'; value: number[] }
)

// Convert 0..1 float RGB to "#rrggbb"
function rgbToHex(arr: number[]): string {
    const c = (i: number) => Math.max(0, Math.min(255, Math.round((arr[i] ?? 0) * 255)))
    const h = (n: number) => n.toString(16).padStart(2, '0')
    return `#${h(c(0))}${h(c(1))}${h(c(2))}`
}

function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    if (!m) return [0, 0, 0]
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

// Stops the node-click bubble so the inspector doesn't pop open / toggle off
// when the user interacts with an editable control inside a node card.
const STOP = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation()

// Inline editor for a single socket value. Picks the right widget based on
// the discriminator. Always tags itself with `nodrag nr-noselect` so it works
// inside ReactFlow node cards too.
export function SocketEditor(props: EditorProps) {
    const wrapperCls = `nodrag nr-noselect ${props.className ?? ''}`

    if (props.kind === 'number') {
        return (
            <div className={wrapperCls} onClick={STOP}>
                <ScrubField label={props.label} value={props.value} onChange={(v) => props.onChange(v)} />
            </div>
        )
    }

    if (props.kind === 'bool') {
        return (
            <label className={`flex items-center gap-2 text-xs ${wrapperCls}`} onClick={STOP}>
                <input
                    type="checkbox"
                    checked={props.value}
                    onChange={(e) => props.onChange(e.target.checked)}
                    style={{ accentColor: '#fb8b1e', cursor: 'pointer' }}
                />
                {props.label && <span className="text-[var(--color-text-muted)]">{props.label}</span>}
            </label>
        )
    }

    if (props.kind === 'string') {
        return (
            <div className={wrapperCls} onClick={STOP}>
                <input
                    type="text"
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                />
            </div>
        )
    }

    if (props.kind === 'color') {
        const arr = Array.isArray(props.value) && props.value.length >= 3 ? props.value : [1, 1, 1, 1]
        const hex = rgbToHex(arr)
        return (
            <div className={`flex items-center gap-1.5 ${wrapperCls}`} onClick={STOP}>
                {props.label && <span className="text-[10px] text-[var(--color-text-muted)] flex-1 truncate">{props.label}</span>}
                {/* Native input[type=color] gives us a real OS color picker for free. */}
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => {
                        const [r, g, b] = hexToRgb(e.target.value)
                        // Preserve any 4th (alpha) component the caller had.
                        const alpha = arr.length >= 4 ? arr[3] : 1
                        props.onChange([r, g, b, alpha])
                    }}
                    onClick={STOP}
                    style={{
                        width: 22,
                        height: 16,
                        padding: 0,
                        border: '1px solid #1a1a1a',
                        borderRadius: 2,
                        cursor: 'pointer',
                        background: 'transparent',
                    }}
                    title={`${hex} (click to edit)`}
                />
            </div>
        )
    }

    // Vector: 2 or 3 scrub fields side by side. Editing one component preserves
    // the others.
    const v = Array.isArray(props.value) ? props.value : [0, 0, 0]
    return (
        <div className={`flex items-center gap-1 ${wrapperCls}`} onClick={STOP}>
            {props.label && <span className="text-[10px] text-[var(--color-text-muted)] flex-1 truncate">{props.label}</span>}
            {v.slice(0, 3).map((n, i) => (
                <div key={i} className="flex-1 min-w-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-1">
                    <ScrubField
                        value={typeof n === 'number' ? n : 0}
                        onChange={(nv) => {
                            const next = [...v]
                            next[i] = nv
                            props.onChange(next)
                        }}
                    />
                </div>
            ))}
        </div>
    )
}
