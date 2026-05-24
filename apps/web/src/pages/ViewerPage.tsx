import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNodeStore } from '@/stores/nodeStore'
import { api } from '@/lib/api'
import { NodeGraph } from '@/components/NodeGraph'
import { NodeInspector } from '@/components/NodeInspector'
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
    const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

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
    // the source textarea. We always pipe via JSON because the python encoder
    // takes a {nodes, links} dict and emits any target format.
    async function applyEdits() {
        if (!tree || !format) return
        setApplying(true)
        setApplyError(null)
        try {
            const jsonContent = JSON.stringify({ nodes: tree.nodes, links: tree.links })
            const result = format === 'json'
                ? { output: jsonContent }
                : await api.convert(jsonContent, format, 'json')
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

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                <div>
                    <h1 className="text-2xl font-bold">Editor</h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Paste any node tree and see it rendered. Nothing is uploaded unless you publish.
                    </p>
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
                        onClick={handlePublish}
                        disabled={!isValid}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Publish this tree
                    </button>
                </div>
            </div>

            <div className={`mt-6 grid gap-6 ${selectedNode && tree ? 'lg:grid-cols-[1fr_1.5fr_18rem]' : 'lg:grid-cols-[1fr_1.5fr]'}`}>
                {/* Input column */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label htmlFor="viewer-input" className="text-sm font-medium">Node tree data</label>
                        <button
                            type="button"
                            onClick={handlePaste}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] cursor-pointer transition-colors"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            Paste
                        </button>
                    </div>
                    <textarea
                        id="viewer-input"
                        value={input}
                        onChange={(e) => { setInput(e.target.value); trigger(e.target.value) }}
                        placeholder="Paste Hash, JSON, XML, or AI JSON node data…"
                        spellCheck={false}
                        className="h-72 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                    />
                    {applyError && (
                        <p role="alert" className="text-xs text-red-400">{applyError}</p>
                    )}
                    {hasInput && (
                        <div aria-live="polite" className="flex flex-wrap gap-2">
                            {format && (
                                <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs">
                                    <span className="text-[var(--color-text-faint)]">Format </span>
                                    <span className="font-semibold">{FORMAT_LABELS[format]}</span>
                                </span>
                            )}
                            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs">
                                <span className="text-[var(--color-text-faint)]">Nodes </span>
                                <span className="font-semibold">{nodeCount}</span>
                            </span>
                            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs">
                                <span className="text-[var(--color-text-faint)]">Links </span>
                                <span className="font-semibold">{linkCount}</span>
                            </span>
                            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${isValid ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                                {isValid ? '✓ Valid' : '✗ Cannot parse'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Graph preview */}
                <div className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden" style={{ height: '480px' }}>
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
                        <div className="flex h-full items-center justify-center p-8">
                            <p className="text-sm text-[var(--color-text-faint)] text-center">
                                {hasInput ? 'Parsing…' : 'Paste node data on the left to see the graph here.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Inspector panel - desktop sidebar, mobile drawer */}
                {selectedNode && tree && (
                    <NodeInspector
                        tree={tree}
                        nodeName={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onSelect={(n) => setSelectedNode(n)}
                        className="h-[480px] hidden lg:flex"
                    />
                )}
            </div>

            {/* Mobile / tablet inspector: full-width below graph */}
            {selectedNode && tree && (
                <div className="mt-4 lg:hidden">
                    <NodeInspector
                        tree={tree}
                        nodeName={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onSelect={(n) => setSelectedNode(n)}
                        className="max-h-[480px]"
                    />
                </div>
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
                                className="h-full border-0 rounded-none"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
