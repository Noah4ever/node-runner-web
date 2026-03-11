import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useNodeStore, useAuthStore } from '@/stores/nodeStore'
import { useInspect, useValidate, useCreateShare, useAuth } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { NodeGraph } from '@/components/NodeGraph'
import { TagSelect, ALL_TAGS } from '@/components/TagSelect'
import type { NodeTree } from '@node-runner/shared'

type Step = 'paste' | 'details' | 'published'

export function UploadPage() {
    const { rawInput, setRawInput, detectedFormat, parsedTree, metadata, setParsedTree, setDetectedFormat, setMetadata } = useNodeStore()
    const { token } = useAuthStore()
    const { user } = useAuth()
    const [input, setInput] = useState(rawInput)
    const [step, setStep] = useState<Step>('paste')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [images, setImages] = useState<string[]>([])
    const [shareSlug, setShareSlug] = useState('')
    const [livePreview, setLivePreview] = useState<NodeTree | null>(null)
    const [liveFormat, setLiveFormat] = useState<string | null>(null)
    const [liveNodeCount, setLiveNodeCount] = useState(0)
    const [liveLinkCount, setLiveLinkCount] = useState(0)

    const inspectMutation = useInspect()
    const validateMutation = useValidate()
    const shareMutation = useCreateShare()
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // If rawInput was set from homepage, auto-inspect on mount
    useEffect(() => {
        if (rawInput) {
            setInput(rawInput)
            triggerLivePreview(rawInput)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Live preview: debounce inspect as user types/pastes
    const triggerLivePreview = useCallback((value: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!value.trim()) {
            setLivePreview(null)
            setLiveFormat(null)
            setLiveNodeCount(0)
            setLiveLinkCount(0)
            return
        }
        debounceRef.current = setTimeout(async () => {
            try {
                const result = await api.inspect(value.trim())
                const tree = result.tree as unknown as NodeTree | null
                setLivePreview(tree)
                setLiveFormat(result.format as string)
                const meta = result.metadata as Record<string, unknown> | undefined
                setLiveNodeCount((meta?.nodeCount as number) ?? 0)
                setLiveLinkCount((meta?.linkCount as number) ?? 0)
            } catch {
                setLivePreview(null)
                setLiveFormat(null)
                setLiveNodeCount(0)
                setLiveLinkCount(0)
            }
        }, 400)
    }, [])

    function handleInputChange(value: string) {
        setInput(value)
        triggerLivePreview(value)
    }

    const hasInput = input.trim().length > 0
    const liveIsValid = livePreview !== null && Object.keys(livePreview.nodes).length > 0

    const STEPS = ['paste', 'details', 'published'] as const
    const STEP_LABELS = ['Paste', 'Details', 'Published']
    const stepIndex = STEPS.indexOf(step)

    function handleStepClick(targetStep: Step, targetIndex: number) {
        if (targetIndex < stepIndex) {
            setStep(targetStep)
        }
    }

    function handleContinue() {
        const value = input.trim()
        if (!value || !liveIsValid) return
        setRawInput(value)
        // Store the live data into the global store
        if (livePreview) setParsedTree(livePreview)
        if (liveFormat) setDetectedFormat(liveFormat as never)
        if (liveNodeCount || liveLinkCount) {
            setMetadata({
                nodeCount: liveNodeCount,
                linkCount: liveLinkCount,
                nodeTypes: [],
                hasGroups: false,
                format: (liveFormat ?? 'json') as never,
                warnings: [],
            })
        }
        setStep('details')
    }

    async function handlePasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText()
            if (text) {
                setInput(text)
                triggerLivePreview(text)
            }
        } catch {
            // Clipboard access denied
        }
    }

    function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) return
        if (file.size > 2 * 1024 * 1024) return // 2MB max
        const maxImages = isLoggedIn ? 4 : 1
        if (images.length >= maxImages) return
        const reader = new FileReader()
        reader.onload = () => {
            setImages((prev) => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
        // Reset input so the same file can be re-selected
        e.target.value = ''
    }

    function handlePublish() {
        if (!input.trim() || !title.trim()) return
        shareMutation.mutate(
            {
                title: title.trim(),
                content: input.trim(),
                format: liveFormat ?? detectedFormat ?? 'json',
                description: description.trim() || undefined,
                isPublic: true,
                tags: selectedTags.length > 0 ? selectedTags : undefined,
                images: images.length > 0 ? images : undefined,
            },
            {
                onSuccess: (data) => {
                    const slug = (data as Record<string, unknown>).slug as string
                    setShareSlug(slug)
                    setStep('published')
                },
            }
        )
    }

    const shareUrl = shareSlug ? `${window.location.origin}/share/${shareSlug}` : ''
    const isLoggedIn = !!token && !!user

    return (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
            {/* Step indicator — clickable to go back */}
            <div className="mb-10 flex items-center justify-center gap-2">
                {STEPS.map((s, i) => {
                    const isActive = s === step
                    const isDone = i < stepIndex
                    const isClickable = isDone
                    return (
                        <div key={s} className="flex items-center gap-2">
                            {i > 0 && <div className={`h-px w-8 ${isDone || isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />}
                            <button
                                type="button"
                                onClick={() => handleStepClick(s, i)}
                                disabled={!isClickable}
                                className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${isActive ? 'bg-[var(--color-accent)] text-black' :
                                    isDone ? 'bg-[var(--color-accent)] text-black opacity-60 hover:opacity-80' :
                                        'bg-[var(--color-surface)] text-[var(--color-text-faint)] border border-[var(--color-border)]'
                                    }`}>
                                    {isDone ? '✓' : i + 1}
                                </div>
                                <span className={`text-sm hidden sm:inline ${isActive ? 'font-semibold text-[var(--color-text)]' : isDone ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}>
                                    {STEP_LABELS[i]}
                                </span>
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Step 1: Paste */}
            {step === 'paste' && (
                <div>
                    <h1 className="text-2xl font-bold">Paste your node tree</h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Paste the output from the Node Runner Blender addon. Supports Hash, JSON, XML, and AI JSON.
                    </p>

                    {/* Anonymous notice */}
                    {!isLoggedIn && (
                        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                            <strong>Uploading anonymously.</strong> You won't be able to edit or delete this upload.{' '}
                            <Link to="/signin" className="underline hover:text-amber-200">Sign in</Link> to manage your uploads.
                        </div>
                    )}

                    <div className="mt-6 space-y-6">
                        {/* Input */}
                        <div>
                            {/* Paste from clipboard — above textarea */}
                            <button
                                onClick={handlePasteFromClipboard}
                                className="mb-3 inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Paste from clipboard
                            </button>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onPaste={() => {
                                    setTimeout(() => {
                                        const value = textareaRef.current?.value ?? ''
                                        if (value.trim()) triggerLivePreview(value)
                                    }, 50)
                                }}
                                placeholder="Paste node tree data here..."
                                className="h-64 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                                autoFocus
                            />

                            {/* Live stats */}
                            {hasInput && liveFormat && (
                                <div className="mt-3 flex flex-wrap gap-3">
                                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                                        <span className="text-xs text-[var(--color-text-faint)]">Format: </span>
                                        <span className="text-xs font-semibold">{liveFormat.toUpperCase().replace('_', ' ')}</span>
                                    </div>
                                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                                        <span className="text-xs text-[var(--color-text-faint)]">Nodes: </span>
                                        <span className="text-xs font-semibold">{liveNodeCount}</span>
                                    </div>
                                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                                        <span className="text-xs text-[var(--color-text-faint)]">Links: </span>
                                        <span className="text-xs font-semibold">{liveLinkCount}</span>
                                    </div>
                                    <div className={`rounded-md border px-3 py-2 ${liveIsValid ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                                        <span className={`text-xs font-semibold ${liveIsValid ? 'text-green-400' : 'text-red-400'}`}>
                                            {liveIsValid ? '✓ Valid' : '✗ Invalid'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-3">
                                <button
                                    onClick={handleContinue}
                                    disabled={!hasInput || !liveIsValid}
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40 cursor-pointer"
                                >
                                    Continue
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </button>
                                {hasInput && !liveIsValid && liveFormat && (
                                    <p className="mt-2 text-xs text-red-400">Could not parse any nodes. Check the format and try again.</p>
                                )}
                            </div>
                        </div>

                        {/* Full-width graph preview below */}
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden" style={{ height: '400px' }}>
                            {livePreview && Object.keys(livePreview.nodes).length > 0 ? (
                                <NodeGraph tree={livePreview} className="h-full w-full" />
                            ) : (
                                <div className="flex h-full items-center justify-center p-8">
                                    <p className="text-sm text-[var(--color-text-faint)]">
                                        {input.trim() ? 'Parsing preview...' : 'Graph preview will appear here'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Details */}
            {step === 'details' && (
                <div>
                    {/* Back arrow at top-left */}
                    <button
                        onClick={() => setStep('paste')}
                        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        Back to paste
                    </button>

                    <h1 className="text-2xl font-bold">Add details</h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Give your upload a title and an optional description before publishing.
                    </p>

                    {/* Anonymous notice */}
                    {!isLoggedIn && (
                        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                            <strong>Publishing anonymously.</strong> You won't be able to edit or delete this upload later.{' '}
                            <Link to="/signin" className="underline hover:text-amber-200">Sign in</Link> to keep control of your uploads.
                        </div>
                    )}

                    {/* Title & Description */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium mb-1.5">Title <span className="text-red-400">*</span></label>
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                                placeholder="e.g. Stylized Glass Shader"
                                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium mb-1.5">Description <span className="text-[var(--color-text-faint)]">(optional)</span></label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                                placeholder="What does this node tree do?"
                                className="h-24 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Tags <span className="text-[var(--color-text-faint)]">(optional)</span></label>
                            <TagSelect selected={selectedTags} onChange={setSelectedTags} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Images <span className="text-[var(--color-text-faint)]">(optional, max {isLoggedIn ? 4 : 1})</span>
                            </label>
                            {images.length > 0 && (
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {images.map((img, i) => (
                                        <div key={i} className="relative">
                                            <img src={img} alt={`Image ${i + 1}`} className="h-32 rounded-md border border-[var(--color-border)] object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                            {i === 0 && (
                                                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Cover</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {images.length < (isLoggedIn ? 4 : 1) && (
                                <label className="flex h-24 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors">
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    <span className="inline-flex items-center gap-2">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        {images.length === 0 ? 'Choose an image (max 2 MB each)' : 'Add another image'}
                                    </span>
                                </label>
                            )}
                            {!isLoggedIn && images.length >= 1 && (
                                <p className="mt-2 text-xs text-amber-400">
                                    <Link to="/signin" className="underline hover:text-amber-300">Sign in</Link> to upload up to 4 images.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            disabled={!title.trim() || shareMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40 cursor-pointer"
                            onClick={handlePublish}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {shareMutation.isPending ? 'Publishing...' : 'Publish'}
                        </button>
                    </div>
                    {shareMutation.isError && (
                        <p className="mt-3 text-sm text-red-400">{(shareMutation.error as Error)?.message || 'Publishing failed. Please try again.'}</p>
                    )}
                </div>
            )}

            {/* Step 3: Published */}
            {step === 'published' && (
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30 text-green-400">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold">Published!</h1>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        Your node tree is live. Share the link below.
                    </p>

                    <div className="mx-auto mt-8 max-w-md">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={shareUrl}
                                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-mono text-[var(--color-text-muted)]"
                            />
                            <button
                                onClick={() => navigator.clipboard.writeText(shareUrl)}
                                className="rounded-md border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            to={`/share/${shareSlug}`}
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-accent-hover)]"
                        >
                            View page
                        </Link>
                        <button
                            onClick={() => {
                                setStep('paste')
                                setInput('')
                                setRawInput('')
                                setTitle('')
                                setDescription('')
                                setSelectedTags([])
                                setImages([])
                                setShareSlug('')
                                setLivePreview(null)
                            }}
                            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors cursor-pointer"
                        >
                            Upload another
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
