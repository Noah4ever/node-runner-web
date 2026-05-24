// Minimal Blender-shader-graph -> Three.js MeshStandardMaterial compiler.
//
// Goal: cover ~60-70% of common shader shares (Principled BSDF, Diffuse,
// Emission, Background, with simple Mix / RGB / Value upstream). Anything more
// exotic (procedural textures, image textures, vector math) returns null and
// lets the caller show "Preview not available".
//
// We walk back from the Material Output's Surface input, resolve the BSDF
// node, then for each MeshStandardMaterial-relevant input we follow the
// upstream chain to extract a constant color or scalar.

import type { NodeTree, NodeData, NodeLink } from '@node-runner/shared'

export interface CompiledMaterial {
    baseColor: [number, number, number]   // 0..1 RGB
    metallic: number                      // 0..1
    roughness: number                     // 0..1
    emissive: [number, number, number]    // 0..1 RGB, sum with material
    emissiveIntensity: number
    opacity: number                       // 0..1
    transparent: boolean
}

export interface CompileResult {
    material: CompiledMaterial | null
    /** When material is null, this lists what stopped us so the UI can say "uses X, Y". */
    unsupported: string[]
    /** Set when the tree has no surface/output node at all. */
    noOutput: boolean
}

const SUPPORTED_BSDFS = new Set([
    'ShaderNodeBsdfPrincipled',
    'ShaderNodeBsdfDiffuse',
    'ShaderNodeEmission',
    'ShaderNodeBackground',
    'ShaderNodeBsdfGlass',
    'ShaderNodeBsdfTransparent',
    'ShaderNodeMixShader',
    'ShaderNodeAddShader',
])

const SUPPORTED_VALUE_NODES = new Set([
    'ShaderNodeRGB',
    'ShaderNodeValue',
    'ShaderNodeMixRGB',
    'ShaderNodeMix',
])

const DEFAULT_MATERIAL: CompiledMaterial = {
    baseColor: [0.8, 0.8, 0.8],
    metallic: 0,
    roughness: 0.5,
    emissive: [0, 0, 0],
    emissiveIntensity: 0,
    opacity: 1,
    transparent: false,
}

// Pull a value out of a positional input array, returning the unwrapped value
// (handles both raw entries and {name, value} wrappers).
function inputValue(inputs: unknown[], index: number): unknown {
    const raw = inputs[index]
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as object)) {
        return (raw as { value: unknown }).value
    }
    return raw
}

// Some Blender JSON exports key inputs by name in an object, others use array.
// inputs is typed as unknown[] in the schema so we treat positionally.
function findInputIndexByName(node: NodeData, name: string): number {
    const arr = node.inputs as unknown[]
    for (let i = 0; i < arr.length; i++) {
        const raw = arr[i]
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { name?: unknown }).name === name) {
            return i
        }
    }
    return -1
}

function getLinkInto(links: NodeLink[], toNode: string, toSocket: string): NodeLink | undefined {
    return links.find((l) => l.toNode === toNode && l.toSocket === toSocket)
}

// Resolve a color from the upstream chain. Returns null when we hit something
// we can't translate, in which case unsupported tracks the offending node type.
function resolveColor(
    tree: NodeTree,
    upstream: NodeLink | undefined,
    fallback: [number, number, number],
    unsupported: Set<string>,
    depth: number,
): [number, number, number] | null {
    if (!upstream) return fallback
    if (depth > 8) return null // pathological - give up
    const node = tree.nodes[upstream.fromNode]
    if (!node) return fallback

    if (node.type === 'ShaderNodeRGB') {
        // RGB has a single Color output stored as input[0] default (Blender quirk)
        const v = inputValue(node.inputs as unknown[], 0)
        if (Array.isArray(v) && v.length >= 3) {
            return [v[0] as number, v[1] as number, v[2] as number]
        }
        // Properties.color is sometimes where the constant lives
        const p = (node.properties?.color) as unknown
        if (Array.isArray(p) && p.length >= 3) return [p[0] as number, p[1] as number, p[2] as number]
        return fallback
    }

    if (node.type === 'ShaderNodeMixRGB' || node.type === 'ShaderNodeMix') {
        const facIdx = findInputIndexByName(node, 'Fac') >= 0 ? findInputIndexByName(node, 'Fac') : 0
        const aIdx = findInputIndexByName(node, 'Color1') >= 0 ? findInputIndexByName(node, 'Color1') : 1
        const bIdx = findInputIndexByName(node, 'Color2') >= 0 ? findInputIndexByName(node, 'Color2') : 2
        const facRaw = inputValue(node.inputs as unknown[], facIdx)
        const fac = typeof facRaw === 'number' ? Math.max(0, Math.min(1, facRaw)) : 0.5
        const a = resolveColor(tree, getLinkInto(tree.links, upstream.fromNode, 'Color1'), arrayOr(node, aIdx, fallback), unsupported, depth + 1)
        const b = resolveColor(tree, getLinkInto(tree.links, upstream.fromNode, 'Color2'), arrayOr(node, bIdx, fallback), unsupported, depth + 1)
        if (!a || !b) return null
        return [
            a[0] * (1 - fac) + b[0] * fac,
            a[1] * (1 - fac) + b[1] * fac,
            a[2] * (1 - fac) + b[2] * fac,
        ]
    }

    // Color Ramp: pick the middle element (or average them). We can't evaluate
    // the ramp at the upstream Fac without a Three.js shader, so we just give
    // back a representative color so the BSDF isn't stuck at default white.
    if (node.type === 'ShaderNodeValToRGB') {
        const ramp = (node.properties?.color_ramp ?? (node as unknown as { settings?: { color_ramp?: unknown } }).settings?.color_ramp) as
            | { elements?: { color?: number[] }[] }
            | undefined
        const elements = ramp?.elements
        if (Array.isArray(elements) && elements.length > 0) {
            // Average over all stops - tends to produce a balanced color.
            let r = 0, g = 0, b = 0, n = 0
            for (const el of elements) {
                const c = el?.color
                if (Array.isArray(c) && c.length >= 3) {
                    r += c[0]; g += c[1]; b += c[2]; n++
                }
            }
            if (n > 0) return [r / n, g / n, b / n]
        }
        return fallback
    }

    // Pass-throughs - these don't change the upstream color.
    if (node.type === 'ShaderNodeMapping' || node.type === 'ShaderNodeBump' || node.type === 'ShaderNodeNormal' || node.type === 'ShaderNodeNormalMap' || node.type === 'ShaderNodeBrightContrast' || node.type === 'ShaderNodeGamma' || node.type === 'ShaderNodeHueSaturation' || node.type === 'ShaderNodeInvert' || node.type === 'ShaderNodeRGBCurve') {
        // First input that's usually the color slot
        const colorLink = tree.links.find((l) => l.toNode === upstream.fromNode && (l.toSocket === 'Color' || l.toSocket === 'Color1'))
        if (colorLink) {
            return resolveColor(tree, colorLink, fallback, unsupported, depth + 1)
        }
        // No upstream - use the stored Color input value if any
        const c = inputValue(node.inputs as unknown[], 0)
        if (Array.isArray(c) && c.length >= 3) return [c[0] as number, c[1] as number, c[2] as number]
        return fallback
    }

    unsupported.add(node.type)
    return null
}

function arrayOr(node: NodeData, idx: number, fallback: [number, number, number]): [number, number, number] {
    const v = inputValue(node.inputs as unknown[], idx)
    if (Array.isArray(v) && v.length >= 3) return [v[0] as number, v[1] as number, v[2] as number]
    return fallback
}

// Resolve a scalar (float) from the upstream chain.
function resolveScalar(
    tree: NodeTree,
    upstream: NodeLink | undefined,
    fallback: number,
    unsupported: Set<string>,
    depth: number,
): number | null {
    if (!upstream) return fallback
    if (depth > 8) return null
    const node = tree.nodes[upstream.fromNode]
    if (!node) return fallback
    if (node.type === 'ShaderNodeValue') {
        const v = inputValue(node.inputs as unknown[], 0)
        if (typeof v === 'number') return v
        return fallback
    }
    // Approximations for common nodes we can't really compute. Pick something
    // sensible so the downstream BSDF still has plausible values.
    if (node.type === 'ShaderNodeFresnel') {
        // Fresnel typically drives roughness or mix factor; ~0.5 is a balanced
        // approximation of a sphere's average viewing angle.
        return 0.5
    }
    if (node.type === 'ShaderNodeLayerWeight') {
        // Same idea - Facing/Fresnel outputs average to ~0.5 on a sphere.
        const blend = inputValue(node.inputs as unknown[], 0)
        return typeof blend === 'number' ? Math.max(0, Math.min(1, blend)) : 0.5
    }
    if (node.type === 'ShaderNodeMath') {
        // Math could be anything; give up gracefully and use the fallback.
        return fallback
    }
    unsupported.add(node.type)
    return null
}

function getSocketValueOrLinked(
    tree: NodeTree,
    node: NodeData,
    nodeId: string,
    socketName: string,
    defaultIndex: number,
    fallback: [number, number, number] | number,
    unsupported: Set<string>,
    isScalar: boolean,
): [number, number, number] | number | null {
    const link = getLinkInto(tree.links, nodeId, socketName)
    if (link) {
        const resolved = isScalar
            ? resolveScalar(tree, link, fallback as number, unsupported, 0)
            : resolveColor(tree, link, fallback as [number, number, number], unsupported, 0)
        // Upstream node is supported and gave us a value? Use it.
        if (resolved !== null) return resolved
        // Otherwise fall through to the node's own stored input value, which is
        // what Blender keeps as the socket's default when something is linked
        // into it. Always better than null - the user's tree might have a usable
        // value even though one upstream node is unsupported.
    }
    const raw = inputValue(node.inputs as unknown[], defaultIndex)
    if (isScalar) {
        return typeof raw === 'number' ? raw : (fallback as number)
    }
    if (Array.isArray(raw) && raw.length >= 3) {
        return [raw[0] as number, raw[1] as number, raw[2] as number]
    }
    // Some uploads store a color socket as a single scalar (the user typed
    // 0.25 instead of [0.25, 0.25, 0.25]); treat it as grayscale so we don't
    // fall through to the white fallback.
    if (typeof raw === 'number') {
        return [raw, raw, raw]
    }
    return fallback as [number, number, number]
}

function resolveSurface(
    tree: NodeTree,
    nodeId: string,
    unsupported: Set<string>,
    depth: number,
): CompiledMaterial | null {
    if (depth > 6) return null
    const node = tree.nodes[nodeId]
    if (!node) return null

    if (!SUPPORTED_BSDFS.has(node.type)) {
        unsupported.add(node.type)
        return null
    }

    // Mix Shader: blend two upstream shaders by Fac. Add Shader: average them.
    // Recurse into both inputs; if one fails, fall back to the other.
    if (node.type === 'ShaderNodeMixShader' || node.type === 'ShaderNodeAddShader') {
        const link1 = getLinkInto(tree.links, nodeId, 'Shader')
        // Two sockets share the name "Shader" - find both by position.
        const shaderLinks = tree.links.filter((l) => l.toNode === nodeId && l.toSocket === 'Shader')
        const linkA = shaderLinks[0]
        const linkB = shaderLinks[1] ?? link1
        const a = linkA ? resolveSurface(tree, linkA.fromNode, unsupported, depth + 1) : null
        const b = linkB && linkB !== linkA ? resolveSurface(tree, linkB.fromNode, unsupported, depth + 1) : null
        if (!a && !b) return null
        if (!a) return b
        if (!b) return a
        // Blend factor: MixShader takes Fac (input 0); AddShader = 0.5 implicit.
        let fac = 0.5
        if (node.type === 'ShaderNodeMixShader') {
            const facLink = getLinkInto(tree.links, nodeId, 'Fac')
            if (facLink) {
                const f = resolveScalar(tree, facLink, 0.5, unsupported, 0)
                if (typeof f === 'number') fac = f
            } else {
                const raw = inputValue(node.inputs as unknown[], 0)
                if (typeof raw === 'number') fac = Math.max(0, Math.min(1, raw))
            }
        }
        return {
            baseColor: [
                a.baseColor[0] * (1 - fac) + b.baseColor[0] * fac,
                a.baseColor[1] * (1 - fac) + b.baseColor[1] * fac,
                a.baseColor[2] * (1 - fac) + b.baseColor[2] * fac,
            ],
            metallic: a.metallic * (1 - fac) + b.metallic * fac,
            roughness: a.roughness * (1 - fac) + b.roughness * fac,
            emissive: [
                a.emissive[0] * (1 - fac) + b.emissive[0] * fac,
                a.emissive[1] * (1 - fac) + b.emissive[1] * fac,
                a.emissive[2] * (1 - fac) + b.emissive[2] * fac,
            ],
            emissiveIntensity: a.emissiveIntensity * (1 - fac) + b.emissiveIntensity * fac,
            opacity: a.opacity * (1 - fac) + b.opacity * fac,
            transparent: a.transparent || b.transparent,
        }
    }

    return buildLeafBsdf(tree, node, nodeId, unsupported)
}

function buildLeafBsdf(
    tree: NodeTree,
    node: NodeData,
    id: string,
    unsupported: Set<string>,
): CompiledMaterial {
    const material: CompiledMaterial = { ...DEFAULT_MATERIAL }
    switch (node.type) {
        case 'ShaderNodeBsdfPrincipled': {
            // Principled BSDF inputs (Blender 4.x):
            // 0=Base Color, 1=Metallic, 2=Roughness, 3=IOR, 4=Alpha, 5..=Subsurface...
            const base = getSocketValueOrLinked(tree, node, id, 'Base Color', 0, [0.8, 0.8, 0.8], unsupported, false)
            if (Array.isArray(base)) material.baseColor = base
            const metal = getSocketValueOrLinked(tree, node, id, 'Metallic', 1, 0, unsupported, true)
            if (typeof metal === 'number') material.metallic = metal
            const rough = getSocketValueOrLinked(tree, node, id, 'Roughness', 2, 0.5, unsupported, true)
            if (typeof rough === 'number') material.roughness = rough
            const alpha = getSocketValueOrLinked(tree, node, id, 'Alpha', 4, 1, unsupported, true)
            if (typeof alpha === 'number') {
                material.opacity = alpha
                if (alpha < 1) material.transparent = true
            }
            const emissionIdx = findInputIndexByName(node, 'Emission Color')
            if (emissionIdx >= 0) {
                const v = inputValue(node.inputs as unknown[], emissionIdx)
                if (Array.isArray(v) && v.length >= 3) {
                    material.emissive = [v[0] as number, v[1] as number, v[2] as number]
                }
            }
            const strengthIdx = findInputIndexByName(node, 'Emission Strength')
            if (strengthIdx >= 0) {
                const v = inputValue(node.inputs as unknown[], strengthIdx)
                if (typeof v === 'number') material.emissiveIntensity = v
            }
            break
        }
        case 'ShaderNodeBsdfDiffuse': {
            const base = getSocketValueOrLinked(tree, node, id, 'Color', 0, [0.8, 0.8, 0.8], unsupported, false)
            if (Array.isArray(base)) material.baseColor = base
            const rough = getSocketValueOrLinked(tree, node, id, 'Roughness', 1, 1, unsupported, true)
            if (typeof rough === 'number') material.roughness = rough
            material.metallic = 0
            break
        }
        case 'ShaderNodeEmission':
        case 'ShaderNodeBackground': {
            const col = getSocketValueOrLinked(tree, node, id, 'Color', 0, [1, 1, 1], unsupported, false)
            if (Array.isArray(col)) material.emissive = col
            const str = getSocketValueOrLinked(tree, node, id, 'Strength', 1, 1, unsupported, true)
            if (typeof str === 'number') material.emissiveIntensity = str
            material.baseColor = [0, 0, 0]
            material.roughness = 1
            break
        }
        case 'ShaderNodeBsdfGlass': {
            const col = getSocketValueOrLinked(tree, node, id, 'Color', 0, [1, 1, 1], unsupported, false)
            if (Array.isArray(col)) material.baseColor = col
            material.roughness = 0.05
            material.metallic = 0
            material.opacity = 0.35
            material.transparent = true
            break
        }
        case 'ShaderNodeBsdfTransparent': {
            const col = getSocketValueOrLinked(tree, node, id, 'Color', 0, [1, 1, 1], unsupported, false)
            if (Array.isArray(col)) material.baseColor = col
            material.opacity = 0.2
            material.transparent = true
            break
        }
        default:
            unsupported.add(node.type)
            break
    }
    return material
}

export function compileTree(tree: NodeTree | null): CompileResult {
    if (!tree) return { material: null, unsupported: [], noOutput: true }

    // Find Material Output (could be named anything; identified by type).
    const outputEntry = Object.entries(tree.nodes).find(([, n]) => n.type === 'ShaderNodeOutputMaterial' || n.type === 'ShaderNodeOutputWorld')
    if (!outputEntry) return { material: null, unsupported: [], noOutput: true }
    const [outputId] = outputEntry

    const surfaceLink = getLinkInto(tree.links, outputId, 'Surface')
    const unsupported = new Set<string>()

    if (!surfaceLink) {
        return { material: { ...DEFAULT_MATERIAL }, unsupported: [], noOutput: false }
    }

    const material = resolveSurface(tree, surfaceLink.fromNode, unsupported, 0)
    if (!material) {
        return { material: null, unsupported: Array.from(unsupported), noOutput: false }
    }

    return {
        material,
        unsupported: Array.from(unsupported).filter((t) => !SUPPORTED_VALUE_NODES.has(t) && !SUPPORTED_BSDFS.has(t)),
        noOutput: false,
    }
}
