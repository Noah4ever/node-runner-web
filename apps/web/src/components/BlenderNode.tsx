import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

// Hidden handle style used by the compact node so edges can attach but the
// dots don't visually appear.
const HIDDEN_HANDLE = { background: 'transparent', border: 'none', width: 1, height: 1 } as const

// What the parent NodeGraph computes once per tree and stuffs into each ReactFlow
// node's `data`. Keeping all derivation in one place means BlenderNode is purely
// presentational - it doesn't fetch, parse, or look anything up.
export interface BlenderSocket {
    name: string
    value: unknown
    /** Whether any link references this socket on this node */
    linked: boolean
    /** Hex color for the socket dot, inferred from value + name */
    color: string
    /** Coarse type bucket used for value rendering (color swatch vs number) */
    kind: 'value' | 'vector' | 'color' | 'bool' | 'string' | 'shader' | 'unknown'
}

export interface BlenderProperty {
    key: string
    value: unknown
}

export interface BlenderNodeData {
    /** Pretty name shown in the header bar (label or short type) */
    title: string
    /** Full Blender type, e.g. ShaderNodeTexNoise - shown small under the title */
    subtitle: string
    /** Header bar color from getNodeColor() */
    headerColor: string
    inputs: BlenderSocket[]
    outputs: BlenderSocket[]
    properties: BlenderProperty[]
    /** Whether the node is currently selected (driven by parent) */
    isSelected: boolean
}

// Format a scalar/array for inline display inside the small value box on the
// right of an input row. Short forms only - the inspector panel has room for
// the verbose view.
function formatInline(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return String(v)
        return v.toFixed(3)
    }
    if (typeof v === 'string') return v
    if (Array.isArray(v)) {
        if (v.length === 0) return ''
        if (v.every((x) => typeof x === 'number')) {
            // Vec3/vec4 condensed: "0.50, 0.50, 0.50"
            return v.map((x) => (Number.isInteger(x) ? String(x) : (x as number).toFixed(2))).join(', ')
        }
        return ''
    }
    return ''
}

// Property values are usually short enum strings or numbers in Blender's UI.
// Render them like Blender's inline dropdown cells.
function formatProperty(v: unknown): string {
    if (v === null || v === undefined) return '-'
    if (typeof v === 'boolean') return v ? 'On' : 'Off'
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
    if (typeof v === 'string') return v
    if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
        return v.map((x) => (Number.isInteger(x) ? String(x) : (x as number).toFixed(2))).join(', ')
    }
    return '...'
}

// CSS for a colored socket dot. ReactFlow's Handle accepts a style prop and
// renders a 6x6 circle by default; we override size + color.
function socketStyle(color: string) {
    return {
        background: color,
        border: '2px solid #1a1a1a',
        width: 12,
        height: 12,
    }
}

function BlenderNodeImpl({ data }: NodeProps<BlenderNodeData>) {
    const { title, subtitle, headerColor, inputs, outputs, properties, isSelected } = data

    return (
        <div
            style={{
                minWidth: 200,
                background: '#2a2a2a',
                border: isSelected ? '2px solid #fff' : '1px solid #1a1a1a',
                borderRadius: 6,
                boxShadow: isSelected ? '0 0 0 3px rgba(255,180,0,0.35)' : '0 1px 3px rgba(0,0,0,0.6)',
                color: '#e5e5e5',
                fontSize: 11,
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
        >
            {/* Header bar - Blender-style colored top */}
            <div
                style={{
                    background: headerColor,
                    color: '#fff',
                    padding: '4px 8px',
                    borderTopLeftRadius: 5,
                    borderTopRightRadius: 5,
                    fontWeight: 600,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}
                title={subtitle}
            >
                <span style={{ opacity: 0.7, fontSize: 9 }}>▾</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            </div>

            {/* Outputs - top, right-aligned, handles on right edge */}
            {outputs.length > 0 && (
                <div style={{ padding: '4px 0' }}>
                    {outputs.map((s, i) => (
                        <div
                            key={`o-${i}-${s.name}`}
                            style={{
                                position: 'relative',
                                padding: '3px 12px',
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={s.name}
                                style={socketStyle(s.color)}
                            />
                            <span style={{ color: '#e5e5e5' }}>{s.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Properties - inline dropdown-style cells between outputs and inputs */}
            {properties.length > 0 && (
                <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {properties.map((p) => (
                        <div
                            key={p.key}
                            title={`${p.key}: ${formatProperty(p.value)}`}
                            style={{
                                background: '#3a3a3a',
                                border: '1px solid #1a1a1a',
                                borderRadius: 3,
                                padding: '2px 6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <span style={{ color: '#a0a0a0', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.key}</span>
                            <span style={{ color: '#e5e5e5', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, textAlign: 'right' }}>
                                {formatProperty(p.value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Inputs - bottom, left-aligned, handles on left edge.
                Linked inputs show only name. Unlinked numeric/scalar inputs show
                the default value in a Blender-style embedded value cell. */}
            {inputs.length > 0 && (
                <div style={{ padding: '4px 0', borderTop: properties.length === 0 && outputs.length > 0 ? '1px solid #1a1a1a' : undefined }}>
                    {inputs.map((s, i) => {
                        const formatted = !s.linked ? formatInline(s.value) : ''
                        const showValueBox = !s.linked && (s.kind === 'value' || s.kind === 'vector' || s.kind === 'bool' || s.kind === 'string') && formatted.length > 0
                        const showColorSwatch = !s.linked && s.kind === 'color' && Array.isArray(s.value)
                        return (
                            <div
                                key={`i-${i}-${s.name}`}
                                style={{
                                    position: 'relative',
                                    padding: '3px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={s.name}
                                    style={socketStyle(s.color)}
                                />
                                {showValueBox || showColorSwatch ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flex: 1,
                                            alignItems: 'center',
                                            background: '#3a3a3a',
                                            border: '1px solid #1a1a1a',
                                            borderRadius: 3,
                                            padding: '1px 6px',
                                            gap: 6,
                                            minWidth: 0,
                                        }}
                                    >
                                        <span style={{ color: '#e5e5e5', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                        {showColorSwatch ? (
                                            <span
                                                style={{
                                                    background: rgbaToCss(s.value as number[]),
                                                    border: '1px solid #1a1a1a',
                                                    width: 22,
                                                    height: 10,
                                                    borderRadius: 2,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        ) : (
                                            <span style={{ color: '#e5e5e5', fontSize: 10, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatted}</span>
                                        )}
                                    </div>
                                ) : (
                                    <span style={{ color: '#e5e5e5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function rgbaToCss(arr: number[]): string {
    const r = Math.round(((arr[0] ?? 0) as number) * 255)
    const g = Math.round(((arr[1] ?? 0) as number) * 255)
    const b = Math.round(((arr[2] ?? 0) as number) * 255)
    const a = arr.length >= 4 ? (arr[3] as number) : 1
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

export const BlenderNode = memo(BlenderNodeImpl)

// Stripped-down node for Discover thumbnails: just a colored block with a label,
// no sockets, no values. Detailed cards can't fit at thumbnail scale - this gives
// a clean overview that reads at a glance.
function CompactNodeImpl({ data }: NodeProps<BlenderNodeData>) {
    return (
        <div
            style={{
                position: 'relative',
                background: data.headerColor,
                border: '1px solid #1a1a1a',
                borderRadius: 3,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                color: '#fff',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 80,
                maxWidth: 160,
            }}
            title={data.subtitle}
        >
            {/* Default handles so edges still draw in thumbnail mode. Hidden
                visually since the simplified block has no socket detail. */}
            <Handle type="target" position={Position.Left} style={HIDDEN_HANDLE} isConnectable={false} />
            <Handle type="source" position={Position.Right} style={HIDDEN_HANDLE} isConnectable={false} />
            {data.title}
        </div>
    )
}
export const CompactNode = memo(CompactNodeImpl)

