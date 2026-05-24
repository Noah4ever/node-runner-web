import { useMemo } from 'react'
import { useSocketNames } from '@/hooks/useApi'
import { SocketEditor } from './SocketEditor'
import type { NodeData, NodeLink, NodeTree } from '@node-runner/shared'

interface NodeInspectorProps {
    tree: NodeTree
    nodeName: string
    onClose: () => void
    onSelect?: (name: string) => void
    /** When set, the inspector renders edit controls and emits changes. */
    editable?: boolean
    /** Positional input change. socketIndex matches the position in node.inputs. */
    onInputChange?: (nodeId: string, socketIndex: number, next: unknown) => void
    /** Property change by key. */
    onPropertyChange?: (nodeId: string, key: string, next: unknown) => void
    className?: string
}

// Pick the right editor kind for a value. Tries to be robust about Blender's
// occasional non-uniform shapes (scalar in a color slot, array for vector).
function detectKind(value: unknown): 'number' | 'bool' | 'string' | 'color' | 'vector' | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'boolean') return 'bool'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    if (Array.isArray(value) && value.every((x) => typeof x === 'number')) {
        if (value.length === 4 && value.every((x) => (x as number) >= 0 && (x as number) <= 1)) return 'color'
        if (value.length === 3 && value.every((x) => (x as number) >= 0 && (x as number) <= 1)) return 'color'
        if (value.length >= 2) return 'vector'
    }
    return null
}

// Pretty-print a value for the inspector. Arrays of numbers become "1.00, 2.00, 3.00".
function formatValue(v: unknown): string {
    if (v === null || v === undefined) return '-'
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return String(v)
        // 4 sig digits then trim trailing zeros so 0.05333 stays compact.
        return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    }
    if (typeof v === 'string') return v
    if (Array.isArray(v)) {
        if (v.length === 0) return '[]'
        if (v.every((x) => typeof x === 'number')) {
            return v.map((x) => Number.isInteger(x) ? String(x) : (x as number).toFixed(3)).join(', ')
        }
        return JSON.stringify(v)
    }
    try { return JSON.stringify(v) } catch { return String(v) }
}

// Some node types serialize sockets as the raw default value (e.g. `3`, `[1,2,3]`).
// Others wrap them as `{name, value}` or `{name, value, type}` so the real socket
// name travels with the value. Normalize both shapes into one place.
function extractSocket(raw: unknown, fallbackName: string): { name: string; value: unknown } {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as { name?: unknown; value?: unknown }
        if (typeof obj.name === 'string' && 'value' in obj) {
            return { name: obj.name, value: obj.value }
        }
    }
    return { name: fallbackName, value: raw }
}

// Single value, or fall back to a JSON pre-block for objects that aren't
// recognised socket wrappers.
function ValueCell({ value }: { value: unknown }) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return (
            <pre className="m-0 overflow-x-auto rounded bg-[var(--color-bg)] p-1.5 font-mono text-[10px] leading-snug text-[var(--color-text-muted)]">
                {JSON.stringify(value, null, 2)}
            </pre>
        )
    }
    return <span className="font-mono text-xs text-[var(--color-text)] break-all">{formatValue(value)}</span>
}

export function NodeInspector({ tree, nodeName, onClose, onSelect, editable, onInputChange, onPropertyChange, className = '' }: NodeInspectorProps) {
    const node = tree.nodes[nodeName] as NodeData | undefined
    const { data: socketNames } = useSocketNames()

    // Pretty socket name from the upstream INPUT_NAMES/OUTPUT_NAMES tables.
    // Falls back to "in[i]"/"out[i]" if the lookup tables haven't loaded yet
    // or the node type is unknown.
    function inputName(type: string, i: number): string {
        return socketNames?.inputs[type]?.[i] ?? `in[${i}]`
    }
    function outputName(type: string, i: number): string {
        return socketNames?.outputs[type]?.[i] ?? `out[${i}]`
    }

    // Incoming = links where this node is the destination. Outgoing = links where
    // this node is the source. Links use NAMED sockets ("Color", "Mesh") while
    // node.inputs / node.outputs are positional value arrays - we don't have the
    // socket-name lookup client-side yet, so we render connections as their own
    // section rather than pairing them to specific value rows.
    const { incoming, outgoing } = useMemo(() => {
        const inc: NodeLink[] = []
        const out: NodeLink[] = []
        for (const link of tree.links) {
            if (link.toNode === nodeName) inc.push(link)
            if (link.fromNode === nodeName) out.push(link)
        }
        return { incoming: inc, outgoing: out }
    }, [tree.links, nodeName])

    if (!node) {
        return (
            <aside className={`flex h-full items-center justify-center text-sm text-[var(--color-text-faint)] ${className}`}>
                Node not found
            </aside>
        )
    }

    // Inputs/outputs in stored format are flat arrays of default-values indexed by
    // socket position. We render them indexed; named lookup would require pulling
    // INPUT_NAMES/OUTPUT_NAMES from node_data.py which we don't have client-side yet.
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    const outputs = Array.isArray(node.outputs) ? node.outputs : []
    const properties = node.properties ?? {}
    const propertyEntries = Object.entries(properties)

    const x = typeof node.location === 'object' && node.location !== null && 'x' in node.location
        ? (node.location as { x: number }).x
        : Array.isArray(node.location) ? (node.location as number[])[0] : 0
    const y = typeof node.location === 'object' && node.location !== null && 'y' in node.location
        ? (node.location as { y: number }).y
        : Array.isArray(node.location) ? (node.location as number[])[1] : 0

    return (
        <aside className={`flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden ${className}`}>
            <header className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{node.label || node.name || nodeName}</h3>
                    <p className="mt-0.5 text-[11px] font-mono text-[var(--color-text-faint)] truncate">{node.type}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close inspector"
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>

            <div className="overflow-y-auto divide-y divide-[var(--color-border)]">
                {/* Meta */}
                <section className="px-3 py-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                        <span className="text-[var(--color-text-faint)]">Name</span>
                        <span className="font-mono text-[var(--color-text)] truncate">{node.name || nodeName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-[var(--color-text-faint)]">Location</span>
                        <span className="font-mono text-[var(--color-text)]">{Math.round(x)}, {Math.round(y)}</span>
                    </div>
                    {node.parent && (
                        <div className="flex justify-between gap-2">
                            <span className="text-[var(--color-text-faint)]">Parent</span>
                            <span className="font-mono text-[var(--color-text)] truncate">{node.parent}</span>
                        </div>
                    )}
                </section>

                {/* Connections */}
                <section className="px-3 py-2.5">
                    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                        Connections <span className="text-[var(--color-text-faint)] normal-case font-normal">({incoming.length + outgoing.length})</span>
                    </h4>
                    {incoming.length + outgoing.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-faint)]">No connections</p>
                    ) : (
                        <ul className="space-y-1">
                            {incoming.map((link, i) => (
                                <li key={`in-${i}`} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-faint)] mb-0.5">
                                        <svg className="h-2.5 w-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l-7 7 7 7" /></svg>
                                        in &middot; <span className="text-[var(--color-text-muted)]">{link.toSocket}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(link.fromNode)}
                                        className="text-left text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] cursor-pointer break-all"
                                    >
                                        from <span className="font-mono">{link.fromNode}</span>
                                        <span className="text-[var(--color-text-faint)]">.{link.fromSocket}</span>
                                    </button>
                                </li>
                            ))}
                            {outgoing.map((link, i) => (
                                <li key={`out-${i}`} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-faint)] mb-0.5">
                                        <svg className="h-2.5 w-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 5l7 7-7 7" /></svg>
                                        out &middot; <span className="text-[var(--color-text-muted)]">{link.fromSocket}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(link.toNode)}
                                        className="text-left text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] cursor-pointer break-all"
                                    >
                                        to <span className="font-mono">{link.toNode}</span>
                                        <span className="text-[var(--color-text-faint)]">.{link.toSocket}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Inputs — prefer the embedded socket name (authoritative, comes
                    from Blender at serialize time); fall back to the upstream lookup
                    table, then to in[i]. */}
                <section className="px-3 py-2.5">
                    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                        Inputs <span className="text-[var(--color-text-faint)] normal-case font-normal">({inputs.length})</span>
                    </h4>
                    {inputs.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-faint)]">No input sockets</p>
                    ) : (
                        <ul className="space-y-1">
                            {inputs.map((raw, i) => {
                                const { name, value } = extractSocket(raw, inputName(node.type, i))
                                const isLinked = incoming.some((l) => l.toSocket === name)
                                const kind = editable && !isLinked ? detectKind(value) : null
                                return (
                                    <li key={i} className={`rounded border px-2 py-1.5 ${isLinked ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}>
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[11px] font-medium text-[var(--color-text)]">{name}</span>
                                            {isLinked && (
                                                <span className="text-[9px] text-green-400">linked</span>
                                            )}
                                        </div>
                                        {kind ? (
                                            <SocketEditor
                                                kind={kind}
                                                value={value as never}
                                                onChange={(v) => onInputChange?.(nodeName, i, v)}
                                            />
                                        ) : (
                                            <ValueCell value={value} />
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>

                {/* Outputs - same shape handling as inputs. */}
                <section className="px-3 py-2.5">
                    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                        Outputs <span className="text-[var(--color-text-faint)] normal-case font-normal">({outputs.length})</span>
                    </h4>
                    {outputs.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-faint)]">No output sockets</p>
                    ) : (
                        <ul className="space-y-1">
                            {outputs.map((raw, i) => {
                                const { name, value } = extractSocket(raw, outputName(node.type, i))
                                const linkCount = outgoing.filter((l) => l.fromSocket === name).length
                                return (
                                    <li key={i} className={`rounded border px-2 py-1.5 ${linkCount > 0 ? 'border-blue-500/30 bg-blue-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}>
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[11px] font-medium text-[var(--color-text)]">{name}</span>
                                            {linkCount > 0 && (
                                                <span className="text-[9px] text-blue-400">{linkCount} link{linkCount !== 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                        <ValueCell value={value} />
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>

                {/* Properties */}
                <section className="px-3 py-2.5">
                    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                        Properties <span className="text-[var(--color-text-faint)] normal-case font-normal">({propertyEntries.length})</span>
                    </h4>
                    {propertyEntries.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-faint)]">No properties</p>
                    ) : (
                        <dl className="space-y-1">
                            {propertyEntries.map(([k, v]) => {
                                const kind = editable ? detectKind(v) : null
                                return (
                                    <div key={k} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
                                        <dt className="text-[10px] font-mono text-[var(--color-text-faint)] mb-0.5">{k}</dt>
                                        <dd>
                                            {kind ? (
                                                <SocketEditor
                                                    kind={kind}
                                                    value={v as never}
                                                    onChange={(nv) => onPropertyChange?.(nodeName, k, nv)}
                                                />
                                            ) : (
                                                <ValueCell value={v} />
                                            )}
                                        </dd>
                                    </div>
                                )
                            })}
                        </dl>
                    )}
                </section>
            </div>
        </aside>
    )
}
