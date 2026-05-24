import { useEffect, useMemo, useState } from 'react'

interface CitationModalProps {
    open: boolean
    onClose: () => void
    title: string
    authorName: string
    slug: string
    createdAt: string
    /** Origin override for SSR / preview environments; defaults to window.location.origin */
    origin?: string
}

type Format = 'apa' | 'mla' | 'bibtex' | 'url'

const TABS: { id: Format; label: string }[] = [
    { id: 'apa', label: 'APA' },
    { id: 'mla', label: 'MLA' },
    { id: 'bibtex', label: 'BibTeX' },
    { id: 'url', label: 'Plain URL' },
]

// Produce a BibTeX key: surname + year + first significant word of title.
function bibtexKey(authorName: string, year: number, title: string): string {
    const surname = authorName.split(/\s+/).pop() ?? authorName
    const safeAuthor = surname.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anonymous'
    const safeTitle = title.toLowerCase().split(/\s+/).find((w) => w.length > 3 && /^[a-z0-9]+$/.test(w)) ?? 'node'
    return `${safeAuthor}${year}${safeTitle}`
}

export function CitationModal({ open, onClose, title, authorName, slug, createdAt, origin }: CitationModalProps) {
    const [tab, setTab] = useState<Format>('apa')
    const [copied, setCopied] = useState<Format | null>(null)

    useEffect(() => {
        if (!open) return
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const url = useMemo(() => {
        const o = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
        return `${o}/share/${slug}`
    }, [origin, slug])

    const year = useMemo(() => new Date(createdAt).getFullYear(), [createdAt])
    const accessed = useMemo(() => {
        const d = new Date()
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }, [])

    const citations: Record<Format, string> = useMemo(() => {
        const apaAuthor = authorName === 'Anonymous' ? 'Anonymous' : authorName
        return {
            apa: `${apaAuthor}. (${year}). ${title} [Node Runner node tree]. ${url}`,
            mla: `${apaAuthor}. "${title}." Node Runner, ${year}, ${url}. Accessed ${accessed}.`,
            bibtex: `@misc{${bibtexKey(apaAuthor, year, title)},\n  author       = {${apaAuthor}},\n  title        = {{${title}}},\n  year         = {${year}},\n  howpublished = {\\url{${url}}},\n  note         = {Node Runner node tree}\n}`,
            url,
        }
    }, [authorName, year, title, url, accessed])

    function handleCopy(format: Format) {
        navigator.clipboard.writeText(citations[format])
        setCopied(format)
        setTimeout(() => setCopied(null), 1500)
    }

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="citation-modal-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-xl"
            >
                <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                    <h2 id="citation-modal-title" className="text-base font-semibold">Cite this node tree</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="flex border-b border-[var(--color-border)]" role="tablist">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${tab === t.id
                                ? 'text-[var(--color-text)] border-b-2 border-[var(--color-accent)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-b-2 border-transparent'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
                        {citations[tab]}
                    </pre>
                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => handleCopy(tab)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${copied === tab ? 'bg-green-600 text-white' : 'bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-hover)]'}`}
                        >
                            {copied === tab ? (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
                            ) : (
                                <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Copy</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
