// Compile a Blender shader node tree into a Three.js-compatible fragment
// shader. The goal is to support the procedural-texture cases the simple
// material-param compiler can't (Noise / Voronoi / Wave + ColorRamp +
// Fresnel + Bump + MixShader) by actually evaluating them per-fragment.
//
// We render with a custom MeshStandardMaterial whose onBeforeCompile hook
// injects:
//   - a prelude with our procedural-noise functions, a 1D color ramp lookup,
//     a tiny scene-light setup, and the compiled node-tree function
//   - replacements for the diffuseColor / roughnessFactor / metalnessFactor /
//     emissive chunks that call into the compiled function
//
// Any unsupported node bails the whole compile - caller falls back to the
// simpler shaderCompile.ts result.

import type { NodeData, NodeLink, NodeTree } from '@node-runner/shared'

export interface GlslResult {
    ok: boolean
    fragmentPrelude?: string
    fragmentCallSetup?: string
    fragmentCallBody?: string
    unsupported: string[]
    noOutput: boolean
}

// ---- helpers ----

function inputValue(inputs: unknown[], index: number): unknown {
    const raw = inputs[index]
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as object)) {
        return (raw as { value: unknown }).value
    }
    return raw
}

function findInputByName(node: NodeData, name: string): { index: number; value: unknown } | null {
    const arr = node.inputs as unknown[]
    for (let i = 0; i < arr.length; i++) {
        const raw = arr[i]
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const obj = raw as { name?: unknown; value?: unknown }
            if (obj.name === name) {
                return { index: i, value: 'value' in obj ? obj.value : raw }
            }
        }
    }
    return null
}

function getLinkInto(links: NodeLink[], toNode: string, toSocket: string): NodeLink | undefined {
    return links.find((l) => l.toNode === toNode && l.toSocket === toSocket)
}

function glslFloat(n: number): string {
    // GLSL requires a decimal point for floats
    if (!isFinite(n)) return '0.0'
    if (Number.isInteger(n)) return n.toFixed(1)
    return String(n)
}

function vec3Literal(v: number[]): string {
    return `vec3(${glslFloat(v[0] ?? 0)}, ${glslFloat(v[1] ?? 0)}, ${glslFloat(v[2] ?? 0)})`
}

// Sample a Blender-style color ramp at fac. We bake the stops into the
// GLSL function below so we don't need a texture.
function emitColorRamp(name: string, elements: { position: number; color: number[] }[]): string {
    const sorted = [...elements].sort((a, b) => a.position - b.position)
    const stops = sorted.map((e) => `    if (fac <= ${glslFloat(e.position)}) return ${vec3Literal(e.color)};`).join('\n')
    const last = sorted[sorted.length - 1]
    return `vec3 ramp_${name}(float fac) {
    fac = clamp(fac, 0.0, 1.0);
${stops}
    return ${vec3Literal(last?.color ?? [1, 1, 1])};
}`
}

// ---- main compiler ----

const SUPPORTED_NODES = new Set([
    'ShaderNodeTexCoord',
    'ShaderNodeMapping',
    'ShaderNodeTexNoise',
    'ShaderNodeTexVoronoi',
    'ShaderNodeTexWave',
    'ShaderNodeValToRGB',
    'ShaderNodeMixRGB',
    'ShaderNodeMix',
    'ShaderNodeMath',
    'ShaderNodeVectorMath',
    'ShaderNodeRGB',
    'ShaderNodeValue',
    'ShaderNodeFresnel',
    'ShaderNodeLayerWeight',
    'ShaderNodeBump',
    'ShaderNodeBsdfPrincipled',
    'ShaderNodeBsdfDiffuse',
    'ShaderNodeEmission',
    'ShaderNodeMixShader',
    'ShaderNodeAddShader',
    'ShaderNodeOutputMaterial',
])

class Compiler {
    private decls: string[] = []
    private body: string[] = []
    private cache = new Map<string, string>()
    private rampDecls: string[] = []
    private varCounter = 0
    public unsupported = new Set<string>()
    private rampCounter = 0

    constructor(private tree: NodeTree) {}

    private nextVar() { return `v${this.varCounter++}` }

    /** Default expressions if we hit something with no link and no good default. */
    private defaultFor(type: 'float' | 'vec3'): string {
        return type === 'float' ? '0.0' : 'vec3(0.0)'
    }

    /** Resolve a node's input socket to a GLSL expression of the given type. */
    private resolveInput(nodeId: string, socketName: string, type: 'float' | 'vec3', fallback?: number | number[]): string {
        const node = this.tree.nodes[nodeId]
        if (!node) return type === 'float' ? glslFloat(typeof fallback === 'number' ? fallback : 0) : vec3Literal(Array.isArray(fallback) ? fallback : [0, 0, 0])

        const link = getLinkInto(this.tree.links, nodeId, socketName)
        if (link) {
            return this.resolveOutput(link.fromNode, link.fromSocket, type)
        }

        // Look at the stored input value
        const byName = findInputByName(node, socketName)
        const raw = byName ? byName.value : undefined
        if (type === 'float') {
            if (typeof raw === 'number') return glslFloat(raw)
            if (Array.isArray(raw) && typeof raw[0] === 'number') return glslFloat(raw[0])
            return glslFloat(typeof fallback === 'number' ? fallback : 0)
        }
        // vec3
        if (Array.isArray(raw) && raw.length >= 3) return vec3Literal(raw as number[])
        if (typeof raw === 'number') return `vec3(${glslFloat(raw)})`
        return vec3Literal(Array.isArray(fallback) ? fallback : (typeof fallback === 'number' ? [fallback, fallback, fallback] : [0, 0, 0]))
    }

    /** Resolve a node's output socket. Caches per node+socket+type. */
    private resolveOutput(nodeId: string, socketName: string, type: 'float' | 'vec3'): string {
        const key = `${nodeId}.${socketName}.${type}`
        if (this.cache.has(key)) return this.cache.get(key)!

        const node = this.tree.nodes[nodeId]
        if (!node) return this.defaultFor(type)

        if (!SUPPORTED_NODES.has(node.type)) {
            this.unsupported.add(node.type)
            return this.defaultFor(type)
        }

        const expr = this.emitNode(nodeId, node, socketName, type)
        const v = this.nextVar()
        this.body.push(`    ${type} ${v} = ${expr};`)
        this.cache.set(key, v)
        return v
    }

    /** Cast helper. */
    private cast(expr: string, from: 'float' | 'vec3', to: 'float' | 'vec3'): string {
        if (from === to) return expr
        if (from === 'float' && to === 'vec3') return `vec3(${expr})`
        // vec3 -> float: luminance
        return `dot(${expr}, vec3(0.2126, 0.7152, 0.0722))`
    }

    private emitNode(id: string, node: NodeData, socketName: string, type: 'float' | 'vec3'): string {
        switch (node.type) {
            case 'ShaderNodeTexCoord': {
                // Generated / Object / UV / Normal - we just give object-space
                // position (close enough for procedural use on a sphere).
                if (socketName === 'UV') return 'vec3(vUv, 0.0)'
                if (socketName === 'Normal') return 'vNormalWorld'
                return 'vPosObj'
            }

            case 'ShaderNodeMapping': {
                const inVec = this.resolveInput(id, 'Vector', 'vec3', [0, 0, 0])
                const loc = this.resolveInput(id, 'Location', 'vec3', [0, 0, 0])
                const scale = this.resolveInput(id, 'Scale', 'vec3', [1, 1, 1])
                // ignore Rotation for v1
                return `((${inVec}) * (${scale}) + (${loc}))`
            }

            case 'ShaderNodeRGB': {
                const v = inputValue(node.inputs as unknown[], 0)
                if (Array.isArray(v) && v.length >= 3) return type === 'float' ? glslFloat(v[0] as number) : vec3Literal(v as number[])
                return type === 'float' ? '0.5' : 'vec3(0.5)'
            }

            case 'ShaderNodeValue': {
                const v = inputValue(node.inputs as unknown[], 0)
                if (typeof v === 'number') return type === 'float' ? glslFloat(v) : `vec3(${glslFloat(v)})`
                return type === 'float' ? '0.5' : 'vec3(0.5)'
            }

            case 'ShaderNodeTexNoise': {
                const vec = this.resolveInput(id, 'Vector', 'vec3', [0, 0, 0])
                const scale = this.resolveInput(id, 'Scale', 'float', 5)
                const detail = this.resolveInput(id, 'Detail', 'float', 2)
                const facExpr = `fbmNoise((${vec}) * (${scale}), int(${detail}))`
                if (socketName === 'Fac') return type === 'vec3' ? `vec3(${facExpr})` : facExpr
                // Color: 3 phased samples for an RGB-ish noise
                const colExpr = `vec3(${facExpr}, fbmNoise((${vec}) * (${scale}) + vec3(13.7), int(${detail})), fbmNoise((${vec}) * (${scale}) + vec3(27.3, 7.1, 19.5), int(${detail})))`
                return type === 'float' ? `(${colExpr}).r` : colExpr
            }

            case 'ShaderNodeTexVoronoi': {
                const vec = this.resolveInput(id, 'Vector', 'vec3', [0, 0, 0])
                const scale = this.resolveInput(id, 'Scale', 'float', 5)
                const distExpr = `voronoiDistance((${vec}) * (${scale}))`
                if (socketName === 'Distance') return type === 'vec3' ? `vec3(${distExpr})` : distExpr
                if (socketName === 'Color') return type === 'float' ? distExpr : `voronoiColor((${vec}) * (${scale}))`
                // Position / Fac fall back to distance
                return type === 'vec3' ? `vec3(${distExpr})` : distExpr
            }

            case 'ShaderNodeTexWave': {
                const vec = this.resolveInput(id, 'Vector', 'vec3', [0, 0, 0])
                const scale = this.resolveInput(id, 'Scale', 'float', 5)
                const distortion = this.resolveInput(id, 'Distortion', 'float', 0)
                const facExpr = `(0.5 + 0.5 * sin(((${vec}).x + (${vec}).y + (${vec}).z) * (${scale}) + (${distortion})))`
                if (socketName === 'Color') return type === 'float' ? facExpr : `vec3(${facExpr})`
                return type === 'vec3' ? `vec3(${facExpr})` : facExpr
            }

            case 'ShaderNodeValToRGB': {
                // Color Ramp - read stops from properties.color_ramp.elements
                const ramp = (node.properties?.color_ramp ?? (node as unknown as { settings?: { color_ramp?: unknown } }).settings?.color_ramp) as
                    | { elements?: { position: number; color: number[] }[] }
                    | undefined
                const elements = (ramp?.elements ?? []).filter((e) => Array.isArray(e?.color) && typeof e?.position === 'number')
                const safe: { position: number; color: number[] }[] = elements.length > 0
                    ? elements as { position: number; color: number[] }[]
                    : [{ position: 0, color: [0, 0, 0] }, { position: 1, color: [1, 1, 1] }]
                const rampName = `r${this.rampCounter++}`
                this.rampDecls.push(emitColorRamp(rampName, safe))
                const fac = this.resolveInput(id, 'Fac', 'float', 0.5)
                if (socketName === 'Color') {
                    const v = `ramp_${rampName}(${fac})`
                    return type === 'float' ? `dot(${v}, vec3(0.333))` : v
                }
                // Alpha output stub: assume opaque
                return type === 'vec3' ? 'vec3(1.0)' : '1.0'
            }

            case 'ShaderNodeMixRGB':
            case 'ShaderNodeMix': {
                const fac = this.resolveInput(id, 'Fac', 'float', 0.5)
                const a = this.resolveInput(id, 'Color1', 'vec3', [0, 0, 0])
                const b = this.resolveInput(id, 'Color2', 'vec3', [1, 1, 1])
                const mixExpr = `mix(${a}, ${b}, clamp(${fac}, 0.0, 1.0))`
                if (socketName === 'Result' || socketName === 'Color') {
                    return type === 'float' ? `dot(${mixExpr}, vec3(0.333))` : mixExpr
                }
                return mixExpr
            }

            case 'ShaderNodeMath': {
                const op = (node.properties?.operation ?? 'ADD') as string
                const a = this.resolveInput(id, 'Value', 'float', 0)
                // The second 'Value' socket - look up by indexed position
                const link2 = this.tree.links.filter((l) => l.toNode === id && l.toSocket === 'Value')[1]
                let b: string
                if (link2) b = this.resolveOutput(link2.fromNode, link2.fromSocket, 'float')
                else {
                    const arr = node.inputs as unknown[]
                    const raw = inputValue(arr, 1)
                    b = typeof raw === 'number' ? glslFloat(raw) : '0.5'
                }
                let expr: string
                switch (op) {
                    case 'MULTIPLY': expr = `((${a}) * (${b}))`; break
                    case 'SUBTRACT': expr = `((${a}) - (${b}))`; break
                    case 'DIVIDE': expr = `((${a}) / max(abs(${b}), 0.0001))`; break
                    case 'POWER': expr = `pow(max(${a}, 0.0), ${b})`; break
                    case 'MINIMUM': expr = `min(${a}, ${b})`; break
                    case 'MAXIMUM': expr = `max(${a}, ${b})`; break
                    case 'MULTIPLY_ADD': expr = `((${a}) * (${b}) + 0.0)`; break
                    case 'ADD':
                    default: expr = `((${a}) + (${b}))`
                }
                return type === 'vec3' ? `vec3(${expr})` : expr
            }

            case 'ShaderNodeVectorMath': {
                const op = (node.properties?.operation ?? 'ADD') as string
                const a = this.resolveInput(id, 'Vector', 'vec3', [0, 0, 0])
                const link2 = this.tree.links.filter((l) => l.toNode === id && l.toSocket === 'Vector')[1]
                let b: string
                if (link2) b = this.resolveOutput(link2.fromNode, link2.fromSocket, 'vec3')
                else {
                    const arr = node.inputs as unknown[]
                    const raw = inputValue(arr, 1)
                    b = Array.isArray(raw) && raw.length >= 3 ? vec3Literal(raw as number[]) : 'vec3(0.0)'
                }
                let expr: string
                switch (op) {
                    case 'MULTIPLY': expr = `((${a}) * (${b}))`; break
                    case 'SUBTRACT': expr = `((${a}) - (${b}))`; break
                    case 'CROSS_PRODUCT': expr = `cross(${a}, ${b})`; break
                    case 'NORMALIZE': expr = `normalize(${a})`; break
                    case 'ADD':
                    default: expr = `((${a}) + (${b}))`
                }
                if (socketName === 'Value') return `dot(${expr}, vec3(0.333))`
                return type === 'float' ? `dot(${expr}, vec3(0.333))` : expr
            }

            case 'ShaderNodeFresnel': {
                const ior = this.resolveInput(id, 'IOR', 'float', 1.45)
                // Fresnel ~ pow(1 - dot(N, V), 5) approximated with IOR-driven exponent
                const expr = `pow(1.0 - max(dot(vNormalWorld, vViewDir), 0.0), max(${ior}, 1.0))`
                return type === 'vec3' ? `vec3(${expr})` : expr
            }

            case 'ShaderNodeLayerWeight': {
                const blend = this.resolveInput(id, 'Blend', 'float', 0.5)
                if (socketName === 'Facing') {
                    const expr = `(1.0 - pow(max(dot(vNormalWorld, vViewDir), 0.0), ${blend} * 5.0 + 0.1))`
                    return type === 'vec3' ? `vec3(${expr})` : expr
                }
                // Fresnel output
                const expr = `pow(1.0 - max(dot(vNormalWorld, vViewDir), 0.0), 5.0)`
                return type === 'vec3' ? `vec3(${expr})` : expr
            }

            case 'ShaderNodeBump': {
                // Bump: we don't actually perturb the normal in a way that
                // shows on a smooth sphere; just pass the world normal through.
                // The height input still resolves so its chain emits.
                this.resolveInput(id, 'Height', 'float', 0)
                return 'vNormalWorld'
            }

            // BSDFs and shaders are not "expressions" in this compile; they're
            // handled by emitSurface() below.
        }
        // Should not reach here for supported nodes; defensive default.
        return this.defaultFor(type)
    }

    // Walk the surface BSDF and emit one struct-like assignment for the
    // final base color, roughness, metallic, emissive. Recurses through
    // MixShader.
    private emitSurface(nodeId: string, fac: string = '1.0'): { color: string; rough: string; metal: string; emit: string; alpha: string } {
        const node = this.tree.nodes[nodeId]
        if (!node) return { color: 'vec3(0.8)', rough: '0.5', metal: '0.0', emit: 'vec3(0.0)', alpha: '1.0' }

        if (node.type === 'ShaderNodeMixShader' || node.type === 'ShaderNodeAddShader') {
            const shaderLinks = this.tree.links.filter((l) => l.toNode === nodeId && l.toSocket === 'Shader')
            const linkA = shaderLinks[0]
            const linkB = shaderLinks[1]
            if (!linkA && !linkB) return { color: 'vec3(0.8)', rough: '0.5', metal: '0.0', emit: 'vec3(0.0)', alpha: '1.0' }
            let mixFac = '0.5'
            if (node.type === 'ShaderNodeMixShader') {
                mixFac = this.resolveInput(nodeId, 'Fac', 'float', 0.5)
            }
            const a = linkA ? this.emitSurface(linkA.fromNode) : null
            const b = linkB ? this.emitSurface(linkB.fromNode) : null
            if (!a) return b!
            if (!b) return a
            return {
                color: `mix(${a.color}, ${b.color}, clamp(${mixFac}, 0.0, 1.0))`,
                rough: `mix(${a.rough}, ${b.rough}, clamp(${mixFac}, 0.0, 1.0))`,
                metal: `mix(${a.metal}, ${b.metal}, clamp(${mixFac}, 0.0, 1.0))`,
                emit: `mix(${a.emit}, ${b.emit}, clamp(${mixFac}, 0.0, 1.0))`,
                alpha: `mix(${a.alpha}, ${b.alpha}, clamp(${mixFac}, 0.0, 1.0))`,
            }
        }

        if (node.type === 'ShaderNodeBsdfPrincipled') {
            return {
                color: this.resolveInput(nodeId, 'Base Color', 'vec3', [0.8, 0.8, 0.8]),
                rough: this.resolveInput(nodeId, 'Roughness', 'float', 0.5),
                metal: this.resolveInput(nodeId, 'Metallic', 'float', 0),
                emit: `(${this.resolveInput(nodeId, 'Emission Color', 'vec3', [0, 0, 0])} * ${this.resolveInput(nodeId, 'Emission Strength', 'float', 1)})`,
                alpha: this.resolveInput(nodeId, 'Alpha', 'float', 1),
            }
        }

        if (node.type === 'ShaderNodeBsdfDiffuse') {
            return {
                color: this.resolveInput(nodeId, 'Color', 'vec3', [0.8, 0.8, 0.8]),
                rough: this.resolveInput(nodeId, 'Roughness', 'float', 1),
                metal: '0.0',
                emit: 'vec3(0.0)',
                alpha: '1.0',
            }
        }

        if (node.type === 'ShaderNodeEmission') {
            const col = this.resolveInput(nodeId, 'Color', 'vec3', [1, 1, 1])
            const str = this.resolveInput(nodeId, 'Strength', 'float', 1)
            return {
                color: 'vec3(0.0)',
                rough: '1.0',
                metal: '0.0',
                emit: `(${col} * ${str})`,
                alpha: '1.0',
            }
        }

        this.unsupported.add(node.type)
        return { color: 'vec3(0.8)', rough: '0.5', metal: '0.0', emit: 'vec3(0.0)', alpha: '1.0' }
    }

    compile(): GlslResult {
        // Find Material Output
        const outputEntry = Object.entries(this.tree.nodes).find(([, n]) => n.type === 'ShaderNodeOutputMaterial')
        if (!outputEntry) return { ok: false, unsupported: [], noOutput: true }

        const [outputId] = outputEntry
        const surfaceLink = getLinkInto(this.tree.links, outputId, 'Surface')
        if (!surfaceLink) return { ok: false, unsupported: [], noOutput: true }

        // Walk to BSDF
        const surface = this.emitSurface(surfaceLink.fromNode)

        if (this.unsupported.size > 0) {
            return { ok: false, unsupported: Array.from(this.unsupported), noOutput: false }
        }

        // Assemble fragment chunks
        const prelude = `
${NOISE_GLSL}
${VORONOI_GLSL}
${this.rampDecls.join('\n')}

varying vec3 vPosObj;
varying vec3 vNormalWorld;
varying vec3 vViewDir;
`

        const callSetup = ''
        const bodyStmts = this.body.join('\n')

        // Inject into MeshStandardMaterial chunks via onBeforeCompile.
        const callBody = `
{
${bodyStmts}
    vec3 nr_diffuseColor = ${surface.color};
    float nr_roughness = clamp(${surface.rough}, 0.04, 1.0);
    float nr_metalness = clamp(${surface.metal}, 0.0, 1.0);
    vec3 nr_emissive = ${surface.emit};

    diffuseColor.rgb = nr_diffuseColor;
    roughnessFactor = nr_roughness;
    metalnessFactor = nr_metalness;
    totalEmissiveRadiance += nr_emissive;
}`

        return {
            ok: true,
            fragmentPrelude: prelude,
            fragmentCallSetup: callSetup,
            fragmentCallBody: callBody,
            unsupported: [],
            noOutput: false,
        }
    }
}

export function compileTreeToGlsl(tree: NodeTree | null): GlslResult {
    if (!tree) return { ok: false, unsupported: [], noOutput: true }
    return new Compiler(tree).compile()
}

// ---- GLSL noise function library (Ashima-style, MIT) ----

const NOISE_GLSL = `
// Stefan Gustavson / Ashima simplex noise (3D), MIT-licensed.
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
        i.z+vec4(0.0,i1.z,i2.z,1.0))
        +i.y+vec4(0.0,i1.y,i2.y,1.0))
        +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbmNoise(vec3 p, int octaves){
    float v=0.0; float a=0.5; vec3 q=p;
    int oct = clamp(octaves, 1, 6);
    for(int i=0;i<6;i++){
        if(i>=oct) break;
        v += a * snoise(q);
        q *= 2.02;
        a *= 0.5;
    }
    return v * 0.5 + 0.5;
}
`

const VORONOI_GLSL = `
// Worley / cellular noise (3D). Returns distance to nearest cell point.
vec3 hash3(vec3 p){
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}
float voronoiDistance(vec3 p){
    vec3 b = floor(p);
    vec3 f = fract(p);
    float minDist = 8.0;
    for(int z=-1; z<=1; z++)
    for(int y=-1; y<=1; y++)
    for(int x=-1; x<=1; x++){
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash3(b + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        minDist = min(minDist, d);
    }
    return sqrt(minDist);
}
vec3 voronoiColor(vec3 p){
    vec3 b = floor(p);
    vec3 f = fract(p);
    float minDist = 8.0;
    vec3 col = vec3(0.0);
    for(int z=-1; z<=1; z++)
    for(int y=-1; y<=1; y++)
    for(int x=-1; x<=1; x++){
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash3(b + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if(d < minDist){
            minDist = d;
            col = hash3(b + g);
        }
    }
    return col;
}
`
