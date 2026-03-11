import { Link } from 'react-router-dom'
import exportVideo from '../assets/export.mp4'
import importVideo from '../assets/import.mp4'

export function HomePage() {
    return (
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
            {/* Hero */}
            <section className="py-24 sm:py-32 text-center">
                <p className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-3">Node Runner</p>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    Share Blender node trees
                </h1>
                <p className="mx-auto mt-4 max-w-md text-lg text-[var(--color-text-muted)]">
                    Upload node trees from the Node Runner addon, get a shareable link, and browse what others have made.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        to="/upload"
                        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] cursor-pointer"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload a node tree
                    </Link>
                    <Link
                        to="/discover"
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-6 py-3 text-base font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        Browse shared trees
                    </Link>
                </div>
            </section>

            {/* Video showcase */}
            <section className="pb-24" style={{ perspective: '1200px' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                    <div
                        className="overflow-hidden rounded-lg border border-[var(--color-border)] shadow-2xl"
                        style={{ transform: 'rotateY(6deg) rotateX(2deg)', transformStyle: 'preserve-3d' }}
                    >
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide text-center py-2 bg-[var(--color-surface)]">Export</p>
                        <video src={exportVideo} autoPlay loop muted playsInline className="w-full block" />
                    </div>
                    <div
                        className="overflow-hidden rounded-lg border border-[var(--color-border)] shadow-2xl"
                        style={{ transform: 'rotateY(-6deg) rotateX(2deg)', transformStyle: 'preserve-3d' }}
                    >
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide text-center py-2 bg-[var(--color-surface)]">Import</p>
                        <video src={importVideo} autoPlay loop muted playsInline className="w-full block" />
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <a
                        href="https://extensions.blender.org/add-ons/node-runner/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)]"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.51 2.59c-.41-.24-.91-.24-1.32 0L2.19 7.41c-.41.24-.66.68-.66 1.15v6.88c0 .47.25.91.66 1.15l9 5.22c.41.24.91.24 1.32 0l9-5.22c.41-.24.66-.68.66-1.15V8.56c0-.47-.25-.91-.66-1.15l-9-4.82zM12 4.67l7.33 4.25L12 13.17 4.67 8.92 12 4.67z" /></svg>
                        Get the Blender Addon
                    </a>
                </div>
            </section>

            {/* How it works — 3 steps */}
            <section className="pb-24">
                <h2 className="mb-8 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    How it works
                </h2>
                <div className="grid gap-px sm:grid-cols-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] overflow-hidden">
                    <div className="bg-[var(--color-surface)] p-8 text-center">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-bold text-lg">1</div>
                        <h3 className="text-sm font-semibold mb-1">Export from Blender</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Use the Node Runner addon to serialize any shader or compositor node tree.
                        </p>
                    </div>
                    <div className="bg-[var(--color-surface)] p-8 text-center">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-bold text-lg">2</div>
                        <h3 className="text-sm font-semibold mb-1">Upload & share</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Paste the output here to get a shareable link with a live graph preview.
                        </p>
                    </div>
                    <div className="bg-[var(--color-surface)] p-8 text-center">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-bold text-lg">3</div>
                        <h3 className="text-sm font-semibold mb-1">Convert & compare</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Switch between Hash, JSON, XML, and AI JSON, or diff two node trees.
                        </p>
                    </div>
                </div>
            </section>

            {/* Formats — simple grid, no accordion */}
            <section className="pb-24">
                <h2 className="mb-8 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Supported formats
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {([
                        ['Hash', 'Compressed base64. Smallest output, best for chat and URLs.'],
                        ['JSON', 'Full structured data. Best for programmatic use.'],
                        ['XML', 'Type-annotated XML for round-trip fidelity.'],
                        ['AI JSON', 'Human-readable format for AI tools like ChatGPT and Claude.'],
                    ] as const).map(([name, desc]) => (
                        <div key={name} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <h3 className="text-sm font-semibold">{name}</h3>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

        </div>
    )
}
