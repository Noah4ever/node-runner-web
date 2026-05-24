import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { compileTree } from '@/lib/shaderCompile'
import { compileTreeToGlsl } from '@/lib/glslShader'
import type { NodeTree } from '@node-runner/shared'

interface ShaderPreviewProps {
    tree: NodeTree | null
    size?: number
    className?: string
}

// Vertex shader: pass object-space position, world-space normal, and
// view direction down to the fragment so the procedural nodes have proper
// inputs (TexCoord-equivalent + Fresnel/LayerWeight + Bump).
const VERT_INJECTION_PROLOGUE = `
varying vec3 vPosObj;
varying vec3 vNormalWorld;
varying vec3 vViewDir;
`

const VERT_INJECTION_BODY = `
vPosObj = position;
vNormalWorld = normalize(normalMatrix * normal);
vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
vViewDir = normalize(-mvPos.xyz);
`

// Live preview of a Blender shader graph on a sphere using Three.js.
// Two compile paths:
//   1. Real GLSL compile (compileTreeToGlsl) - emits a fragment chunk that
//      evaluates noise / voronoi / wave / color-ramp / fresnel etc. per
//      pixel by injecting into MeshStandardMaterial via onBeforeCompile.
//   2. Simple param compile (compileTree) - the fallback when (1) hits an
//      unsupported node; sets MeshStandardMaterial uniforms from approximate
//      static values.
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

    const simple = useMemo(() => compileTree(tree), [tree])
    const glsl = useMemo(() => compileTreeToGlsl(tree), [tree])

    // Scene setup. We re-create the material every time the GLSL changes
    // because onBeforeCompile is a one-shot hook (Three.js compiles a shader
    // program at first render); re-binding requires a new material.
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

        const key = new THREE.DirectionalLight(0xffffff, 2)
        key.position.set(2, 3, 4); scene.add(key)
        const fill = new THREE.DirectionalLight(0xc0d8ff, 0.6)
        fill.position.set(-3, 1, 2); scene.add(fill)
        const rim = new THREE.DirectionalLight(0xffd8b0, 0.8)
        rim.position.set(-1, -2, -3); scene.add(rim)
        scene.add(new THREE.AmbientLight(0xffffff, 0.15))

        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc })

        // If the GLSL compile succeeded, inject our chunk into the shader.
        if (glsl.ok && glsl.fragmentPrelude && glsl.fragmentCallBody) {
            material.onBeforeCompile = (shader) => {
                // Vertex: pass varyings to fragment
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>\n${VERT_INJECTION_PROLOGUE}`,
                )
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <fog_vertex>',
                    `#include <fog_vertex>\n${VERT_INJECTION_BODY}`,
                )
                // Fragment: prelude (varyings + noise libs + ramps) + inject
                // into the lighting chunks. We use logic_phong_fragment? No -
                // for MeshStandardMaterial we inject into the lights_physical
                // chain. Simplest seam: rewrite diffuseColor/roughness/etc.
                // before the lights run via map_fragment.
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>\n${glsl.fragmentPrelude}`,
                )
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    `#include <map_fragment>\n${glsl.fragmentCallBody}`,
                )
            }
        }

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material)
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
        // Re-create everything when the GLSL changes (new tree, new shader
        // program), or when size changes.
    }, [size, glsl.ok, glsl.fragmentPrelude, glsl.fragmentCallBody])

    // When we're in fallback (simple) mode, push the static material params
    // each time they change. No-op when GLSL is doing the work (we'd just
    // overwrite values that the shader sets per-pixel).
    useEffect(() => {
        const s = sceneRef.current
        if (!s || !simple.material) return
        if (glsl.ok) return
        const m = simple.material
        s.material.color.setRGB(m.baseColor[0], m.baseColor[1], m.baseColor[2])
        s.material.metalness = m.metallic
        s.material.roughness = m.roughness
        s.material.emissive.setRGB(m.emissive[0], m.emissive[1], m.emissive[2])
        s.material.emissiveIntensity = m.emissiveIntensity
        s.material.transparent = m.transparent
        s.material.opacity = m.opacity
        s.material.needsUpdate = true
    }, [simple, glsl.ok])

    if (simple.noOutput) {
        return (
            <div className={`flex items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-faint)] ${className}`} style={{ width: size, height: size }}>
                No surface output
            </div>
        )
    }

    // Only show "preview not available" when BOTH compile paths failed.
    if (!simple.material && !glsl.ok) {
        return (
            <div className={`rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)] ${className}`} style={{ width: size }}>
                <p className="font-semibold mb-1">Preview not available</p>
                <p className="text-[var(--color-text-faint)]">Uses node{simple.unsupported.length === 1 ? '' : 's'} we don't render yet:</p>
                <ul className="mt-1 space-y-0.5">
                    {simple.unsupported.map((t) => (
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
            {glsl.ok ? (
                <p className="mt-1.5 text-[10px] text-green-400/70">Live procedural preview</p>
            ) : simple.unsupported.length > 0 ? (
                <p className="mt-1.5 text-[10px] text-amber-400/80" title={simple.unsupported.join(', ')}>
                    Approximated - {simple.unsupported.length} unsupported node{simple.unsupported.length === 1 ? '' : 's'} skipped
                </p>
            ) : null}
        </div>
    )
}
