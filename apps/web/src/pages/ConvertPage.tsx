import { useState } from 'react'
import { NODE_FORMATS, FORMAT_LABELS, type NodeFormat } from '@node-runner/shared'

export function ConvertPage() {
    const [input, setInput] = useState('')
    const [targetFormat, setTargetFormat] = useState<NodeFormat>('json')
    const [output, setOutput] = useState('')

    function handleConvert() {
        // TODO: Call /api/v1/convert
        setOutput(`// TODO: Converted output to ${FORMAT_LABELS[targetFormat]}`)
    }

    return (
        <div className="mx-auto max-w-5xl px-6 py-12">
            <h1 className="text-2xl font-bold">Convert</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Convert node tree data between Hash, JSON, XML, and AI JSON formats.
            </p>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
                {/* Source */}
                <div className="space-y-4">
                    <label className="block text-sm font-medium">Source Input</label>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste source node data..."
                        className="h-56 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                    />
                    <div className="flex items-center gap-4">
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
                            Detected: auto
                        </div>
                    </div>
                </div>

                {/* Target */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium">Output</label>
                        <select
                            value={targetFormat}
                            onChange={(e) => setTargetFormat(e.target.value as NodeFormat)}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                        >
                            {NODE_FORMATS.map((fmt) => (
                                <option key={fmt} value={fmt}>
                                    {FORMAT_LABELS[fmt]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        value={output}
                        readOnly
                        placeholder="Converted output will appear here..."
                        className="h-56 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleConvert}
                            disabled={!input.trim()}
                            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
                        >
                            Convert
                        </button>
                        <button
                            onClick={() => navigator.clipboard.writeText(output)}
                            disabled={!output}
                            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] disabled:opacity-40"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
