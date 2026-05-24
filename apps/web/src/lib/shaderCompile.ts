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
        return isScalar
            ? resolveScalar(tree, link, fallback as number, unsupported, 0)
            : resolveColor(tree, link, fallback as [number, number, number], unsupported, 0)
    }
    const raw = inputValue(node.inputs as unknown[], defaultIndex)
    if (isScalar) {
        return typeof raw === 'number' ? raw : (fallback as number)
    }
    if (Array.isArray(raw) && raw.length >= 3) {
        return [raw[0] as number, raw[1] as number, raw[2] as number]
    }
    return fallback as [number, number, number]
}

export function compileTree(tree: NodeTree | null): CompileResult {
    if (!tree) return { material: null, unsupported: [], noOutput: true }

    // Find Material Output (could be named anything; identified by type).
    const outputEntry = Object.entries(tree.nodes).find(([, n]) => n.type === 'ShaderNodeOutputMaterial' || n.type === 'ShaderNodeOutputWorld')
    if (!outputEntry) return { material: null, unsupported: [], noOutput: true }
    const [outputId] = outputEntry

    const surfaceLink = getLinkInto(tree.links, outputId, 'Surface')
    const unsupported = new Set<string>()
    const material: CompiledMaterial = { ...DEFAULT_MATERIAL }

    if (!surfaceLink) {
        return { material, unsupported: [], noOutput: false }
    }

    const surfaceNode = tree.nodes[surfaceLink.fromNode]
    if (!surfaceNode) return { material, unsupported: [], noOutput: false }

    if (!SUPPORTED_BSDFS.has(surfaceNode.type)) {
        unsupported.add(surfaceNode.type)
        return { material: null, unsupported: Array.from(unsupported), noOutput: false }
    }

    const id = surfaceLink.fromNode
    const node = surfaceNode

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
            return { material: null, unsupported: Array.from(unsupported), noOutput: false }
    }

    // If upstream resolution flagged anything we don't handle, surface that
    // but still ship the partial material so users see *something*. The list
    // is informational ("we approximated, here's what we skipped").
    return {
        material,
        unsupported: Array.from(unsupported).filter((t) => !SUPPORTED_VALUE_NODES.has(t) && !SUPPORTED_BSDFS.has(t)),
        noOutput: false,
    }
}
