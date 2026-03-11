import { useState, useRef, useEffect } from 'react'

// Comprehensive Blender tag list — most commonly used first
const ALL_TAGS = [
    // Most frequently used
    'Shader', 'Geometry Nodes', 'Material', 'Texture', 'Animation',
    'Procedural', 'Compositing', 'Lighting', 'PBR',
    // Material types
    'Glass', 'Metal', 'Wood', 'Fabric', 'Water', 'Stone', 'Concrete',
    'Plastic', 'Ceramic', 'Leather', 'Rubber', 'Ice', 'Crystal',
    // Effects
    'Fire', 'Smoke', 'Particles', 'Fog', 'Glow', 'Caustics',
    'Displacement', 'Volumetric',
    // Surface
    'Normal Map', 'Bump', 'Emission', 'Subsurface', 'Translucent',
    'Transparent', 'Anisotropic', 'Fresnel',
    // Patterns & noise
    'Noise', 'Voronoi', 'Wave', 'Gradient', 'Musgrave',
    'Color Ramp', 'Brick', 'Checker',
    // Geometry
    'Mesh', 'Curve', 'Point Cloud', 'Instances', 'Volume',
    'Boolean', 'Subdivision', 'Array', 'Mirror',
    // Geometry nodes operations
    'Scatter', 'Extrude', 'Bevel', 'Solidify', 'Remesh',
    'Deform', 'Distribute', 'Proximity',
    // Node types
    'Principled BSDF', 'Mix', 'Math', 'Vector Math', 'Mapping',
    'UV', 'Image Texture', 'Environment', 'HDRI',
    // Specialized
    'Hair', 'Fur', 'Grass', 'Foliage', 'Terrain', 'Ocean',
    'Toon', 'NPR', 'Stylized', 'Wireframe', 'Grease Pencil',
    // Use cases
    'Architecture', 'Character', 'Vehicle', 'Sci-Fi', 'Fantasy',
    'Abstract', 'Realistic', 'Low Poly', 'Organic',
]

export function TagSelect({
    selected,
    onChange,
    maxTags = 10,
}: {
    selected: string[]
    onChange: (tags: string[]) => void
    maxTags?: number
}) {
    const [search, setSearch] = useState('')
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const filtered = ALL_TAGS.filter(
        (tag) => !selected.includes(tag) && tag.toLowerCase().includes(search.toLowerCase())
    )

    function toggleTag(tag: string) {
        if (selected.includes(tag)) {
            onChange(selected.filter((t) => t !== tag))
        } else if (selected.length < maxTags) {
            onChange([...selected, tag])
            setSearch('')
        }
    }

    function removeTag(tag: string) {
        onChange(selected.filter((t) => t !== tag))
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Selected tags */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selected.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="hover:text-[var(--color-text)] cursor-pointer ml-0.5"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search input */}
            <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                placeholder={selected.length >= maxTags ? `Max ${maxTags} tags` : 'Search tags...'}
                disabled={selected.length >= maxTags}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
            />

            {/* Dropdown */}
            {open && selected.length < maxTags && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--color-text-faint)]">No matching tags</div>
                    ) : (
                        filtered.map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="flex w-full cursor-pointer items-center px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors text-left"
                            >
                                {tag}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export { ALL_TAGS }
