import { useState, useEffect } from 'react'
import { NODE_FORMATS, FORMAT_LABELS, type NodeFormat } from '@node-runner/shared'
import { api } from '@/lib/api'

interface InlineConvertProps {
    content: string
    sourceFormat: NodeFormat
}

// Compact converter widget for share pages: pick a target format, see the
// converted output, copy. Uses the real Python converter via /api/v1/convert.
export function InlineConvert({ content, sourceFormat }: InlineConvertProps) {
    const otherFormats = NODE_FORMATS.filter((f) => f !== sourceFormat)
    const [target, setTarget] = useState<NodeFormat>(otherFormats[0] ?? 'json')
    const [output, setOutput] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Reset output when target or source changes - stale output is misleading
    useEffect(() => {
        setOutput('')
        setError(null)
    }, [target, content, sourceFormat])

    async function handleConvert() {
        setBusy(true)
        setError(null)
        try {
            const result = await api.convert(content, target, sourceFormat)
            setOutput(result.output)
        } catch (e) {
            setError((e as Error).message || 'Conversion failed')
        } finally {
            setBusy(false)
        }
    }

    function handleCopy() {
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 sm:px-4 py-2.5 sm:py-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Convert</h3>
                    <span className="text-xs text-[var(--color-text-faint)]">
                        {FORMAT_LABELS[sourceFormat]} →
                    </span>
                    <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value as NodeFormat)}
                        aria-label="Target format"
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                    >
                        {otherFormats.map((fmt) => (
                            <option key={fmt} value={fmt}>{FORMAT_LABELS[fmt]}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleConvert}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 cursor-pointer"
                    >
                        {busy ? 'Converting…' : 'Convert'}
                    </button>
                    {output && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors cursor-pointer ${copied ? 'border-green-500/40 text-green-400' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    )}
                </div>
            </div>
            {error && (
                <div role="alert" className="px-4 py-2 text-xs text-red-400 bg-red-500/5 border-b border-red-500/20">
                    {error}
                </div>
            )}
            {output ? (
                <pre className="max-h-72 overflow-auto p-4 font-mono text-xs text-[var(--color-text-muted)] leading-relaxed">
                    {output}
                </pre>
            ) : (
                <div className="px-4 py-6 text-center text-xs text-[var(--color-text-faint)]">
                    Pick a format and click <span className="font-semibold text-[var(--color-text-muted)]">Convert</span> to see this tree in another encoding.
                </div>
            )}
        </div>
    )
}
