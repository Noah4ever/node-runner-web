import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { NODE_FORMATS, FORMAT_LABELS, FORMAT_DESCRIPTIONS, type NodeFormat } from '@node-runner/shared'
import { api } from '@/lib/api'
import { useNodeStore } from '@/stores/nodeStore'

export function ConvertPage() {
    const navigate = useNavigate()
    const { setRawInput, setDetectedFormat: setStoreFormat } = useNodeStore()
    const [input, setInput] = useState('')
    const [targetFormat, setTargetFormat] = useState<NodeFormat>('json')
    const [output, setOutput] = useState('')
    const [detectedFormat, setDetectedFormat] = useState<NodeFormat | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [copied, setCopied] = useState(false)
    const detectDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Auto-detect source format as user types (debounced)
    useEffect(() => {
        if (detectDebounce.current) clearTimeout(detectDebounce.current)
        if (!input.trim()) {
            setDetectedFormat(null)
            return
        }
        detectDebounce.current = setTimeout(async () => {
            try {
                const { format } = await api.detectFormat(input.trim())
                setDetectedFormat(format as NodeFormat)
            } catch {
                setDetectedFormat(null)
            }
        }, 300)
        return () => { if (detectDebounce.current) clearTimeout(detectDebounce.current) }
    }, [input])

    const handleConvert = useCallback(async () => {
        if (!input.trim()) return
        setBusy(true)
        setError(null)
        try {
            const result = await api.convert(input.trim(), targetFormat)
            setOutput(result.output)
            setDetectedFormat(result.sourceFormat as NodeFormat)
        } catch (e) {
            setError((e as Error).message || 'Conversion failed')
            setOutput('')
        } finally {
            setBusy(false)
        }
    }, [input, targetFormat])

    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText()
            if (text) setInput(text)
        } catch { /* clipboard denied */ }
    }

    function handleCopy() {
        if (!output) return
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    function handleSwap() {
        // Use the converted output as the new input, target becomes detected
        if (!output) return
        setInput(output)
        if (detectedFormat) setTargetFormat(detectedFormat)
        setOutput('')
    }

    const sourceMatchesTarget = detectedFormat && detectedFormat === targetFormat
    const hasInput = input.trim().length > 0

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
            <h1 className="text-2xl font-bold">Convert</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Convert node tree data between Hash, JSON, XML, and AI JSON formats.
            </p>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                {/* Source */}
                <section className="space-y-3" aria-labelledby="convert-source-heading">
                    <div className="flex items-center justify-between">
                        <h2 id="convert-source-heading" className="text-sm font-medium">
                            Source
                            {detectedFormat && (
                                <span className="ml-2 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                                    {FORMAT_LABELS[detectedFormat]}
                                </span>
                            )}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] cursor-pointer transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Paste
                            </button>
                            {input && (
                                <button
                                    type="button"
                                    onClick={() => { setInput(''); setOutput(''); setError(null) }}
                                    className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    <textarea
                        id="convert-input"
                        aria-label="Source node tree"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste node tree data here..."
                        className="h-72 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                        spellCheck={false}
                    />
                    <p className="text-xs text-[var(--color-text-faint)] min-h-[1rem]" aria-live="polite">
                        {detectedFormat ? `Auto-detected as ${FORMAT_LABELS[detectedFormat]}.` : hasInput ? 'Detecting format…' : 'Paste content to auto-detect the format.'}
                    </p>
                </section>

                {/* Output */}
                <section className="space-y-3" aria-labelledby="convert-output-heading">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 id="convert-output-heading" className="text-sm font-medium">Output</h2>
                        {/* Format + Convert as ONE connected control group */}
                        <div className="inline-flex rounded-md shadow-sm overflow-hidden border border-[var(--color-border)]">
                            <label htmlFor="convert-target" className="inline-flex items-center bg-[var(--color-surface)] px-2.5 text-xs text-[var(--color-text-faint)] border-r border-[var(--color-border)]">
                                Convert to
                            </label>
                            <select
                                id="convert-target"
                                value={targetFormat}
                                onChange={(e) => setTargetFormat(e.target.value as NodeFormat)}
                                className="bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:bg-[var(--color-surface-hover)] cursor-pointer border-r border-[var(--color-border)]"
                            >
                                {NODE_FORMATS.map((fmt) => (
                                    <option key={fmt} value={fmt}>{FORMAT_LABELS[fmt]}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleConvert}
                                disabled={!hasInput || busy || !!sourceMatchesTarget}
                                className="inline-flex items-center gap-1.5 bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                {busy ? (
                                    <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Working</>
                                ) : (
                                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>Convert</>
                                )}
                            </button>
                        </div>
                    </div>
                    <textarea
                        aria-label="Converted output"
                        value={output}
                        readOnly
                        placeholder={hasInput ? 'Click Convert to generate output…' : 'Converted output will appear here.'}
                        className="h-72 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] resize-none"
                        spellCheck={false}
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <span className="text-[var(--color-text-faint)]">{FORMAT_DESCRIPTIONS[targetFormat]}</span>
                        <div className="flex items-center gap-2">
                            {output && (
                                <button
                                    type="button"
                                    onClick={handleSwap}
                                    className="inline-flex items-center gap-1 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] cursor-pointer"
                                    title="Use output as new input"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    Use as input
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={!output}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${copied ? 'border-green-500/40 text-green-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!input.trim() || !detectedFormat) return
                                    setRawInput(input.trim())
                                    setStoreFormat(detectedFormat)
                                    navigate('/upload?startAt=details')
                                }}
                                disabled={!hasInput || !detectedFormat}
                                title="Send this tree to the upload flow"
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Publish
                            </button>
                        </div>
                    </div>
                    {sourceMatchesTarget && hasInput && (
                        <p className="text-xs text-amber-400" role="status">
                            Source already matches target format. Pick a different output to convert.
                        </p>
                    )}
                </section>
            </div>

            {error && (
                <div role="alert" className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}
        </div>
    )
}
