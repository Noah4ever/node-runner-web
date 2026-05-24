import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNodeStore } from '@/stores/nodeStore'
import { api } from '@/lib/api'
import { NodeGraph } from '@/components/NodeGraph'
import { FORMAT_LABELS, type NodeFormat } from '@node-runner/shared'
import type { NodeTree } from '@node-runner/shared'

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
    const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

    const trigger = useCallback((value: string) => {
        if (debounce.current) clearTimeout(debounce.current)
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
            if (text) { setInput(text); trigger(text) }
        } catch { /* clipboard denied */ }
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
                    <h1 className="text-2xl font-bold">Viewer</h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Paste any node tree and see it rendered. Nothing is uploaded unless you publish.
                    </p>
                </div>
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

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
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
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden" style={{ height: '480px' }}>
                    {tree && Object.keys(tree.nodes).length > 0 ? (
                        <NodeGraph tree={tree} className="h-full w-full" />
                    ) : (
                        <div className="flex h-full items-center justify-center p-8">
                            <p className="text-sm text-[var(--color-text-faint)] text-center">
                                {hasInput ? 'Parsing…' : 'Paste node data on the left to see the graph here.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
