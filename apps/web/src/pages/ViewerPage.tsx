import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNodeStore } from '@/stores/nodeStore'
import { api } from '@/lib/api'
import { NodeGraph } from '@/components/NodeGraph'
import { NodeInspector } from '@/components/NodeInspector'
import { HQRender } from '@/components/HQRender'
import { FORMAT_LABELS, type NodeFormat } from '@node-runner/shared'
import type { NodeTree, NodeData } from '@node-runner/shared'

// Immutable helpers for editing a NodeTree. Sockets serialized as {name, value}
// keep the wrapper shape so re-encode preserves Blender's identification.
function updateNodeInput(tree: NodeTree, nodeId: string, socketIndex: number, next: unknown): NodeTree {
    const node = tree.nodes[nodeId]
    if (!node) return tree
    const inputs = [...(node.inputs as unknown[])]
    const cur = inputs[socketIndex]
    if (cur !== null && typeof cur === 'object' && !Array.isArray(cur) && cur !== undefined && 'name' in (cur as object)) {
        inputs[socketIndex] = { ...(cur as object), value: next }
    } else {
        inputs[socketIndex] = next
    }
    return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, inputs } as NodeData } }
}

function updateNodeProperty(tree: NodeTree, nodeId: string, key: string, next: unknown): NodeTree {
    const node = tree.nodes[nodeId]
    if (!node) return tree
    return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, properties: { ...node.properties, [key]: next } } } }
}

function updateNodePosition(tree: NodeTree, nodeId: string, x: number, y: number): NodeTree {
    const node = tree.nodes[nodeId]
    if (!node) return tree
    const loc = node.location as unknown
    let newLoc: unknown
    if (Array.isArray(loc)) newLoc = [x, y]
    else if (loc && typeof loc === 'object') newLoc = { ...(loc as object), x, y }
    else newLoc = { x, y }
    return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, location: newLoc } as NodeData } }
}

// Paste a node tree, inspect it visually. No publish flow on this page itself -
// the "Publish" button hands off to /upload starting at step 2 (details).
export function ViewerPage() {
    const navigate = useNavigate()
    const { rawInput, setRawInput, setParsedTree, setDetectedFormat, setMetadata } = useNodeStore()
    const [input, setInput] = useState(rawInput)
    const [tree, setTree] = useState<NodeTree | null>(null)
    const [format, setFormat] = useState<NodeFormat | null>(null)
    const [nodeCount, setNodeCount] = useState(0)
    const [linkCount, setLinkCount] = useState(0)
    const [selectedNode, setSelectedNode] = useState<string | null>(null)
    const [graphFullscreen, setGraphFullscreen] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [applying, setApplying] = useState(false)
    const [applyError, setApplyError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    // Default to Source when there's nothing pasted yet so the user sees the
    // paste area immediately. As soon as a valid tree shows up we flip to
    // Render - unless the user has already manually picked a tab.
    const [sidebarTab, setSidebarTab] = useState<'render' | 'inspector' | 'source'>(rawInput ? 'render' : 'source')
    const userPickedTab = useRef(false)
    const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Auto-switch to the inspector tab when a node is selected; flip back to
    // render when it's cleared so the user isn't stuck on an empty inspector.
    useEffect(() => {
        if (selectedNode) setSidebarTab('inspector')
        else if (sidebarTab === 'inspector') setSidebarTab('render')
    }, [selectedNode]) // eslint-disable-line react-hooks/exhaustive-deps

    // First time the tree becomes valid, switch from Source to Render - but
    // only if the user hasn't manually picked a tab in the meantime.
    const hasShownPreviewRef = useRef(false)
    useEffect(() => {
        if (hasShownPreviewRef.current || userPickedTab.current) return
        if (tree && Object.keys(tree.nodes).length > 0 && sidebarTab === 'source') {
            setSidebarTab('render')
            hasShownPreviewRef.current = true
        }
    }, [tree, sidebarTab])

    function pickTab(t: typeof sidebarTab) {
        userPickedTab.current = true
        setSidebarTab(t)
    }

    useEffect(() => {
        if (!graphFullscreen) return
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setGraphFullscreen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [graphFullscreen])

    const trigger = useCallback((value: string) => {
        if (debounce.current) clearTimeout(debounce.current)
        // Drop any node selection from the previous tree - it will dangle
        // otherwise when the new tree has different node ids.
        setSelectedNode(null)
        if (!value.trim()) { setTree(null); setFormat(null); setNodeCount(0); setLinkCount(0); return }
        debounce.current = setTimeout(async () => {
            try {
                const r = await api.inspect(value.trim())
                setTree((r.tree as unknown as NodeTree | null))
                setFormat(r.format as NodeFormat)
                const meta = r.metadata as Record<string, unknown> | undefined
                setNodeCount((meta?.nodeCount as number) ?? 0)
                setLinkCount((meta?.linkCount as number) ?? 0)
            } catch {
                setTree(null); setFormat(null); setNodeCount(0); setLinkCount(0)
            }
        }, 400)
    }, [])

    useEffect(() => { if (rawInput) trigger(rawInput) }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText()
            if (text) { setInput(text); trigger(text); setDirty(false); setApplyError(null) }
        } catch { /* clipboard denied */ }
    }

    async function handleCopy() {
        if (!input.trim()) return
        try {
            await navigator.clipboard.writeText(input)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch { /* clipboard denied */ }
    }

    function handleInputChange(nodeId: string, socketIndex: number, next: unknown) {
        setTree((t) => t ? updateNodeInput(t, nodeId, socketIndex, next) : t)
        setDirty(true)
    }

    function handlePropertyChange(nodeId: string, key: string, next: unknown) {
        setTree((t) => t ? updateNodeProperty(t, nodeId, key, next) : t)
        setDirty(true)
    }

    function handleNodeMove(nodeId: string, x: number, y: number) {
        setTree((t) => t ? updateNodePosition(t, nodeId, x, y) : t)
        setDirty(true)
    }

    // Re-encode the edited tree back into the original format and write it to
    // the source textarea. We always pipe via JSON + the python converter
    // (even json -> json) so it normalizes the JS/API shape into Python's
    // shape with snake_case links and [x,y] locations. Without that the
    // round-trip would still write JS-shape JSON to the textarea, which
    // re-encoding to hash/xml later would choke on.
    async function applyEdits() {
        if (!tree || !format) return
        setApplying(true)
        setApplyError(null)
        try {
            const jsonContent = JSON.stringify({ nodes: tree.nodes, links: tree.links })
            const target: NodeFormat = format
            const result = await api.convert(jsonContent, target, 'json')
            setInput(result.output)
            setRawInput(result.output)
            setDirty(false)
        } catch (e) {
            setApplyError((e as Error).message || 'Failed to apply edits')
        } finally {
            setApplying(false)
        }
    }

    function handlePublish() {
        const v = input.trim()
        if (!v || !tree) return
        setRawInput(v)
        setParsedTree(tree)
        if (format) setDetectedFormat(format)
        setMetadata({
            nodeCount,
            linkCount,
            nodeTypes: [],
            hasGroups: false,
            format: format ?? 'json',
            warnings: [],
        })
        navigate('/upload?startAt=details')
    }

    const hasInput = input.trim().length > 0
    const isValid = tree !== null && Object.keys(tree.nodes).length > 0

    // ---- sidebar tab content ----
    // We keep ALL panels mounted and toggle visibility via CSS instead of
    // conditional rendering. That preserves component state across tab
    // switches - critical for HQRender so a rendered image survives when
    // the user flips to Preview / Inspector / Source and back.
    const sidebarPanels = (
        <>
            <div className="p-3" style={{ display: sidebarTab === 'render' ? 'block' : 'none' }}>
                {tree && format ? (
                    <HQRender content={input} format={format} slug={dirty ? 'editor-draft' : 'editor'} />
                ) : (
                    <p className="text-xs text-[var(--color-text-faint)] text-center py-8">Paste a tree to enable HQ render.</p>
                )}
            </div>
            <div className="h-full" style={{ display: sidebarTab === 'inspector' && selectedNode && tree ? 'block' : 'none' }}>
                {selectedNode && tree && (
                    <NodeInspector
                        tree={tree}
                        nodeName={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onSelect={(n) => setSelectedNode(n)}
                        editable
                        onInputChange={handleInputChange}
                        onPropertyChange={handlePropertyChange}
                        className="h-full border-0 rounded-none"
                    />
                )}
            </div>
            <div className="p-3 flex flex-col gap-2 h-full" style={{ display: sidebarTab === 'source' ? 'flex' : 'none' }}>
                {!hasInput && (
                    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)] space-y-2">
                        <p className="font-semibold text-[var(--color-text)]">Paste a node setup to get started.</p>
                        <p>Export from the Node Runner Blender add-on (Hash, JSON, XML, or AI JSON), or paste any compatible JSON. The graph, preview, and HQ render update live.</p>
                    </div>
                )}
                <div className="flex items-center justify-end gap-1.5">
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!input.trim()}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${copied ? 'border-green-500/40 text-green-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)]'}`}
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                        type="button"
                        onClick={handlePaste}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] cursor-pointer transition-colors"
                    >
                        Paste
                    </button>
                </div>
                <textarea
                    id="viewer-input"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); trigger(e.target.value) }}
                    placeholder="Paste Hash, JSON, XML, or AI JSON node data…"
                    spellCheck={false}
                    className="flex-1 min-h-[260px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                />
                {hasInput && (
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {format && (
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5">
                                {FORMAT_LABELS[format]}
                            </span>
                        )}
                        <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5">{nodeCount} nodes</span>
                        <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5">{linkCount} links</span>
                        <span className={`rounded border px-2 py-0.5 font-semibold ${isValid ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                            {isValid ? 'valid' : 'invalid'}
                        </span>
                    </div>
                )}
            </div>
        </>
    )

    const TabBtn = ({ id, label, disabled = false }: { id: typeof sidebarTab; label: string; disabled?: boolean }) => (
        <button
            type="button"
            onClick={() => pickTab(id)}
            disabled={disabled}
            className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sidebarTab === id ? 'text-[var(--color-text)] border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text)]'}`}
        >
            {label}
        </button>
    )

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] px-3 sm:px-4 py-3">
            {/* Compact header: title + actions on one line. */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
                <div className="flex items-baseline gap-3">
                    <div className="flex items-center gap-1.5">
                        <h1 className="text-xl font-bold">Editor</h1>
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">Beta</span>
                    </div>
                    {hasInput && format && (
                        <span className="text-xs text-[var(--color-text-faint)] hidden sm:inline">
                            {FORMAT_LABELS[format]} &middot; {nodeCount} nodes &middot; {linkCount} links
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {dirty && (
                        <button
                            type="button"
                            onClick={applyEdits}
                            disabled={applying}
                            title="Re-encode the edited tree and write it back to the source textarea"
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            {applying ? 'Applying…' : 'Apply changes'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!input.trim()}
                        title="Copy the current node setup to the clipboard"
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${copied ? 'border-green-500/40 text-green-400 bg-green-500/5' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)]'}`}
                    >
                        {copied ? (
                            <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
                        ) : (
                            <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Copy setup</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handlePublish}
                        disabled={!isValid}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Publish this tree
                    </button>
                </div>
            </div>

            {/* Two-column layout: graph fills the rest, sidebar with tabs on the right. */}
            <div className="flex-1 grid gap-3 min-h-0 grid-cols-1 lg:grid-cols-[1fr_22rem]">
                {/* Graph - fills available height */}
                <div className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden min-h-[400px]">
                    {tree && Object.keys(tree.nodes).length > 0 ? (
                        <>
                            <NodeGraph
                                tree={tree}
                                className="h-full w-full"
                                onNodeClick={(name) => setSelectedNode(name)}
                                selectedNode={selectedNode}
                                editable
                                onInputChange={handleInputChange}
                                onPropertyChange={handlePropertyChange}
                                onNodeMove={handleNodeMove}
                            />
                            <button
                                type="button"
                                onClick={() => setGraphFullscreen(true)}
                                title="Fullscreen"
                                aria-label="Fullscreen"
                                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md bg-black/40 text-white/70 hover:bg-black/60 hover:text-white cursor-pointer transition-colors z-10"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                            </button>
                        </>
                    ) : (
                        <div className="flex h-full min-h-[400px] items-center justify-center p-8">
                            <p className="text-sm text-[var(--color-text-faint)] text-center">
                                {hasInput ? 'Parsing…' : 'Open the Source tab on the right and paste a node tree.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Sidebar with tabs */}
                <aside className="flex flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden min-h-0">
                    <div className="flex border-b border-[var(--color-border)]" role="tablist">
                        <TabBtn id="render" label="Render" />
                        <TabBtn id="inspector" label="Inspector" disabled={!selectedNode || !tree} />
                        <TabBtn id="source" label="Source" />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {sidebarPanels}
                    </div>
                </aside>
            </div>

            {applyError && (
                <p role="alert" className="mt-2 text-xs text-red-400 shrink-0">{applyError}</p>
            )}

            {/* Fullscreen graph - inspector overlays on the right when a node
                is selected, matching the share-page behaviour. */}
            {graphFullscreen && tree && (
                <div className="fixed inset-0 z-50 flex bg-[var(--color-bg)]">
                    <button
                        type="button"
                        onClick={() => setGraphFullscreen(false)}
                        aria-label="Close fullscreen"
                        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer z-20"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <NodeGraph
                            tree={tree}
                            className="h-full w-full"
                            onNodeClick={(name) => setSelectedNode(name)}
                            selectedNode={selectedNode}
                            editable
                            onInputChange={handleInputChange}
                            onPropertyChange={handlePropertyChange}
                            onNodeMove={handleNodeMove}
                        />
                    </div>
                    {selectedNode && (
                        <div className="w-80 border-l border-[var(--color-border)] overflow-y-auto">
                            <NodeInspector
                                tree={tree}
                                nodeName={selectedNode}
                                onClose={() => setSelectedNode(null)}
                                onSelect={(n) => setSelectedNode(n)}
                                editable
                                onInputChange={handleInputChange}
                                onPropertyChange={handlePropertyChange}
                                className="h-full border-0 rounded-none"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
