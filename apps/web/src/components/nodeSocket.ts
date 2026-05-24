import type { BlenderSocket } from './BlenderNode'

// Mirror of node_runner/constants.py _COMMON_NODE_PROPS - these are properties
// every node has (mute, hide, dimensions, etc.) and they would clutter the
// inline node card. The full property list is still available in the inspector.
const COMMON_NODE_PROPS = new Set([
    'color', 'height', 'hide', 'internal_links', 'is_active_output',
    'label', 'location', 'mute', 'name', 'parent', 'select',
    'show_options', 'show_preview', 'show_texture', 'target', 'type',
    'use_custom_color', 'width', 'width_hidden',
])

export function isCommonProperty(key: string): boolean {
    return COMMON_NODE_PROPS.has(key)
}

// Approximate Blender's socket palette. We don't have the actual socket type
// in the serialized data, so we infer from shape + name. Good enough for the
// common cases; rare/edge sockets fall back to gray.
const COLOR_VALUE = '#a1a1a1'        // float / int
const COLOR_BOOL = '#cca6d6'         // boolean
const COLOR_VECTOR = '#6363c7'       // vector / normal
const COLOR_COLOR = '#c7c729'        // RGBA
const COLOR_SHADER = '#63c763'       // shader
const COLOR_GEOMETRY = '#00d6a3'     // geometry
const COLOR_STRING = '#70b2ff'       // string
const COLOR_OBJECT = '#ed9e5c'       // object / collection
const COLOR_IMAGE = '#633563'        // image

// Some names are reliable signals of socket type regardless of value shape.
// Output sockets in particular often have null values, so name patterns are
// the only signal we have.
function inferFromName(name: string): { color: string; kind: BlenderSocket['kind'] } | null {
    const n = name.toLowerCase()
    if (/(bsdf|shader|surface|volume|displacement$)/.test(n)) return { color: COLOR_SHADER, kind: 'shader' }
    if (/(geometry|mesh|curve|points$|instances|volume grid)/.test(n)) return { color: COLOR_GEOMETRY, kind: 'unknown' }
    if (/(color|emission|tint|albedo|diffuse)/.test(n)) return { color: COLOR_COLOR, kind: 'color' }
    if (/(vector|normal|tangent|position|rotation|scale$|location|direction|incoming|reflection)/.test(n)) return { color: COLOR_VECTOR, kind: 'vector' }
    if (/(image|texture)/.test(n)) return { color: COLOR_IMAGE, kind: 'unknown' }
    if (/(object|collection|material)/.test(n)) return { color: COLOR_OBJECT, kind: 'unknown' }
    if (/(string|name$|attribute$)/.test(n)) return { color: COLOR_STRING, kind: 'string' }
    return null
}

function inferFromValue(value: unknown): { color: string; kind: BlenderSocket['kind'] } {
    if (value === null || value === undefined) return { color: COLOR_VALUE, kind: 'unknown' }
    if (typeof value === 'boolean') return { color: COLOR_BOOL, kind: 'bool' }
    if (typeof value === 'number') return { color: COLOR_VALUE, kind: 'value' }
    if (typeof value === 'string') return { color: COLOR_STRING, kind: 'string' }
    if (Array.isArray(value)) {
        // RGBA = 4 numbers in [0, 1]
        if (value.length === 4 && value.every((x) => typeof x === 'number' && (x as number) >= 0 && (x as number) <= 1)) {
            return { color: COLOR_COLOR, kind: 'color' }
        }
        // 3 numbers: most often a vector, sometimes RGB. Default to vector.
        if (value.length === 3 && value.every((x) => typeof x === 'number')) {
            // If all in 0..1 it could be RGB - render as color so the swatch is useful.
            if ((value as number[]).every((x) => x >= 0 && x <= 1)) {
                return { color: COLOR_COLOR, kind: 'color' }
            }
            return { color: COLOR_VECTOR, kind: 'vector' }
        }
    }
    return { color: COLOR_VALUE, kind: 'unknown' }
}

// Combined inference: name signals first (more reliable for outputs / linked
// inputs with null values), then value shape as a fallback.
export function inferSocket(name: string, value: unknown): { color: string; kind: BlenderSocket['kind'] } {
    const byName = inferFromName(name)
    if (byName) return byName
    return inferFromValue(value)
}

// Normalize the raw input/output entry, which is either a scalar/array or a
// {name, value} wrapper. Returns the unwrapped value and the embedded name
// when present (which is authoritative over any lookup table).
export function unwrapSocket(raw: unknown): { name: string | null; value: unknown } {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as { name?: unknown; value?: unknown }
        if (typeof obj.name === 'string' && 'value' in obj) {
            return { name: obj.name, value: obj.value }
        }
    }
    return { name: null, value: raw }
}
