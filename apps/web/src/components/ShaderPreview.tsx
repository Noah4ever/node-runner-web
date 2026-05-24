import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { compileTree } from '@/lib/shaderCompile'
import type { NodeTree } from '@node-runner/shared'

interface ShaderPreviewProps {
    tree: NodeTree | null
    size?: number
    className?: string
}

// Live preview of a Blender shader graph on a sphere using Three.js.
// Best-effort: maps to MeshStandardMaterial. Anything we can't translate
// is listed in the "unsupported" banner below the canvas.
export function ShaderPreview({ tree, size = 220, className = '' }: ShaderPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const sceneRef = useRef<{
        renderer: THREE.WebGLRenderer
        scene: THREE.Scene
        camera: THREE.PerspectiveCamera
        material: THREE.MeshStandardMaterial
        mesh: THREE.Mesh
        raf: number
    } | null>(null)

    const compiled = useMemo(() => compileTree(tree), [tree])

    // One-time scene setup, kept alive across re-renders.
    useEffect(() => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(size, size, false)
        renderer.outputColorSpace = THREE.SRGBColorSpace

        const scene = new THREE.Scene()
        scene.background = null

        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
        camera.position.set(0, 0, 3.5)

        // Three-light setup so PBR materials read well at any roughness.
        const key = new THREE.DirectionalLight(0xffffff, 2)
        key.position.set(2, 3, 4)
        scene.add(key)
        const fill = new THREE.DirectionalLight(0xc0d8ff, 0.6)
        fill.position.set(-3, 1, 2)
        scene.add(fill)
        const rim = new THREE.DirectionalLight(0xffd8b0, 0.8)
        rim.position.set(-1, -2, -3)
        scene.add(rim)
        scene.add(new THREE.AmbientLight(0xffffff, 0.15))

        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material)
        scene.add(mesh)

        let raf = 0
        const tick = (t: number) => {
            mesh.rotation.y = t * 0.0004
            renderer.render(scene, camera)
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        sceneRef.current = { renderer, scene, camera, material, mesh, raf }

        return () => {
            cancelAnimationFrame(raf)
            renderer.dispose()
            material.dispose()
            mesh.geometry.dispose()
        }
    }, [size])

    // Re-apply material params whenever the compile result changes.
    useEffect(() => {
        const s = sceneRef.current
        if (!s || !compiled.material) return
        const m = compiled.material
        s.material.color.setRGB(m.baseColor[0], m.baseColor[1], m.baseColor[2])
        s.material.metalness = m.metallic
        s.material.roughness = m.roughness
        s.material.emissive.setRGB(m.emissive[0], m.emissive[1], m.emissive[2])
        s.material.emissiveIntensity = m.emissiveIntensity
        s.material.transparent = m.transparent
        s.material.opacity = m.opacity
        s.material.needsUpdate = true
    }, [compiled])

    if (compiled.noOutput) {
        return (
            <div className={`flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-faint)] ${className}`} style={{ width: size, height: size }}>
                No surface output
            </div>
        )
    }

    if (!compiled.material) {
        return (
            <div className={`rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)] ${className}`} style={{ width: size }}>
                <p className="font-semibold mb-1">Preview not available</p>
                <p className="text-[var(--color-text-faint)]">Uses node{compiled.unsupported.length === 1 ? '' : 's'} we don't render yet:</p>
                <ul className="mt-1 space-y-0.5">
                    {compiled.unsupported.map((t) => (
                        <li key={t} className="font-mono text-[10px] text-[var(--color-text-muted)]">{t}</li>
                    ))}
                </ul>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`}>
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                style={{ width: size, height: size, display: 'block', borderRadius: 6 }}
            />
            {compiled.unsupported.length > 0 && (
                <p className="mt-1.5 text-[10px] text-amber-400/80" title={compiled.unsupported.join(', ')}>
                    Approximated - {compiled.unsupported.length} unsupported node{compiled.unsupported.length === 1 ? '' : 's'} skipped
                </p>
            )}
        </div>
    )
}
