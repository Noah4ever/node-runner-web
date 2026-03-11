import type { NodeFormat, NodeTree } from '@node-runner/shared'
import type { Parser } from '../types/index.js'
import { inflateSync, inflateRawSync } from 'node:zlib'

// TODO: Replace with real parsers that match the Blender addon's encoding logic.
// Each format (hash, json, xml, ai_json) needs a dedicated parser that mirrors
// the Python addon's serialize/deserialize behavior.

export class PlaceholderParser implements Parser {
    parse(input: string, format: NodeFormat): NodeTree {
        switch (format) {
            case 'json':
                return this.parseStandardJson(input)
            case 'ai_json':
                return this.parseAiJson(input)
            case 'xml':
                return this.parseXml(input)
            case 'hash':
                return this.parseHash(input)
        }
    }

    /** Regular JSON: inputs are positional lists, links are full dicts with from_node/to_node */
    private parseStandardJson(input: string): NodeTree {
        try {
            const data = JSON.parse(input)
            if (!data.nodes || typeof data.nodes !== 'object') {
                return { nodes: {}, links: [] }
            }

            const nodes: NodeTree['nodes'] = {}
            const rawNodes = data.nodes as Record<string, Record<string, unknown>>

            for (const [name, raw] of Object.entries(rawNodes)) {
                const loc = raw.location as unknown
                let x = 0, y = 0
                if (Array.isArray(loc) && loc.length >= 2) {
                    x = Number(loc[0]) || 0
                    y = Number(loc[1]) || 0
                }

                nodes[name] = {
                    type: (raw.type as string) ?? '',
                    name: (raw.name as string) ?? name,
                    label: (raw.label as string) || name,
                    location: { x, y },
                    inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
                    outputs: Array.isArray(raw.outputs) ? raw.outputs : [],
                    properties: {},
                }

                // Gather extra properties (everything except known keys)
                const knownKeys = new Set(['type', 'name', 'label', 'location', 'location_absolute', 'inputs', 'outputs', 'parent'])
                for (const [k, v] of Object.entries(raw)) {
                    if (!knownKeys.has(k)) {
                        nodes[name].properties[k] = v
                    }
                }
                if (raw.parent) {
                    nodes[name].parent = raw.parent as string
                }
            }

            // Links are full dicts: { from_node, from_socket, to_node, to_socket, ... }
            const rawLinks = (data.links ?? []) as Array<Record<string, string>>
            const links: NodeTree['links'] = rawLinks.map((l) => ({
                fromNode: l.from_node ?? '',
                fromSocket: l.from_socket ?? '',
                toNode: l.to_node ?? '',
                toSocket: l.to_socket ?? '',
            }))

            return { nodes, links }
        } catch {
            return { nodes: {}, links: [] }
        }
    }

    /** AI JSON: inputs are named dicts, links are string pairs ["Node.Socket", "Node.Socket"] */
    private parseAiJson(input: string): NodeTree {
        try {
            const data = JSON.parse(input)
            return this.normalizeAiJson(data)
        } catch {
            return { nodes: {}, links: [] }
        }
    }

    private normalizeAiJson(data: Record<string, unknown>): NodeTree {
        const nodes: NodeTree['nodes'] = {}
        const rawNodes = data.nodes as Record<string, Record<string, unknown>>

        for (const [name, raw] of Object.entries(rawNodes)) {
            const loc = raw.location as unknown
            let x = 0, y = 0
            if (Array.isArray(loc) && loc.length >= 2) {
                x = Number(loc[0]) || 0
                y = Number(loc[1]) || 0
            } else if (loc && typeof loc === 'object' && 'x' in (loc as Record<string, unknown>)) {
                x = Number((loc as Record<string, unknown>).x) || 0
                y = Number((loc as Record<string, unknown>).y) || 0
            }

            nodes[name] = {
                type: (raw.type as string) ?? '',
                name,
                label: name,
                location: { x, y },
                inputs: raw.inputs ? Object.entries(raw.inputs as Record<string, unknown>).map(([key, val]) => ({ name: key, value: val })) : [],
                outputs: raw.outputs ? Object.entries(raw.outputs as Record<string, unknown>).map(([key, val]) => ({ name: key, value: val })) : [],
                properties: (raw.settings as Record<string, unknown>) ?? {},
            }
        }

        // Parse links: ["FromNode.Output", "ToNode.Input"]
        const rawLinks = (data.links ?? []) as Array<[string, string]>
        const links: NodeTree['links'] = rawLinks.map(([from, to]) => {
            const fromDot = from.lastIndexOf('.')
            const toDot = to.lastIndexOf('.')
            return {
                fromNode: from.substring(0, fromDot),
                fromSocket: from.substring(fromDot + 1),
                toNode: to.substring(0, toDot),
                toSocket: to.substring(toDot + 1),
            }
        })

        return { nodes, links }
    }

    private parseXml(input: string): NodeTree {
        const nodes: NodeTree['nodes'] = {}
        const links: NodeTree['links'] = []

        // Extract nodes with regex: <node type="..." name="..." label="..." x="..." y="...">
        const nodePattern = /<node\b([^>]*)(?:\/>|>([\s\S]*?)<\/node>)/gi
        let nodeMatch
        let nodeIndex = 0
        while ((nodeMatch = nodePattern.exec(input)) !== null) {
            const attrs = nodeMatch[1]
            const getAttr = (name: string) => {
                const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs)
                return m ? m[1] : ''
            }
            const name = getAttr('name') || `Node_${nodeIndex}`
            const type = getAttr('type') || ''
            const label = getAttr('label') || name
            const x = parseFloat(getAttr('x')) || nodeIndex * 250
            const y = parseFloat(getAttr('y')) || 0

            nodes[name] = {
                type,
                name,
                label,
                location: { x, y },
                inputs: [],
                outputs: [],
                properties: {},
            }
            nodeIndex++
        }

        // Extract links: <link from_node="..." from_socket="..." to_node="..." to_socket="..."/>
        const linkPattern = /<link\b([^>]*)\/?>/gi
        let linkMatch
        while ((linkMatch = linkPattern.exec(input)) !== null) {
            const attrs = linkMatch[1]
            const getAttr = (name: string) => {
                const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs)
                return m ? m[1] : ''
            }
            links.push({
                fromNode: getAttr('from_node'),
                fromSocket: getAttr('from_socket'),
                toNode: getAttr('to_node'),
                toSocket: getAttr('to_socket'),
            })
        }

        return { nodes, links }
    }

    private parseHash(input: string): NodeTree {
        // Hash format: "ExportName__NR<base64_zlib_data>"
        // Strip the header prefix if present
        let payload = input.trim()
        const headerIdx = payload.indexOf('__NR')
        if (headerIdx !== -1) {
            payload = payload.substring(headerIdx + 4)
        }

        // Try base64 decode + zlib decompress to JSON
        try {
            // Handle URL-safe base64 (replace - with + and _ with /)
            let cleaned = payload.replace(/\s+/g, '')
            cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/')
            // Add padding if needed
            while (cleaned.length % 4 !== 0) cleaned += '='

            const bytes = Buffer.from(cleaned, 'base64')

            // Zlib decompress (try zlib format first, then raw deflate)
            const decompressed = this.zlibDecompress(bytes)
            if (decompressed) {
                const jsonStr = new TextDecoder().decode(decompressed)
                const data = JSON.parse(jsonStr)

                // Compact format: { v, n: [...nodes], l: [...links] }
                if ('v' in data && 'n' in data) {
                    return this.expandCompactData(data)
                }

                // Already expanded standard format
                if (data.nodes && typeof data.nodes === 'object' && !Array.isArray(data.nodes)) {
                    const firstNode = Object.values(data.nodes)[0] as Record<string, unknown> | undefined
                    if (firstNode && Array.isArray(firstNode.inputs)) {
                        return this.parseStandardJson(jsonStr)
                    }
                    return this.normalizeAiJson(data)
                }
                return { nodes: {}, links: [] }
            }
        } catch {
            // Fall through
        }
        return { nodes: {}, links: [] }
    }

    /** Expand the compact hash format (v/n/l) to a standard NodeTree */
    private expandCompactData(data: Record<string, unknown>): NodeTree {
        const compactNodes = (data.n ?? []) as unknown[][]
        const compactLinks = (data.l ?? []) as unknown[][]

        // Build node name list for link resolution
        const nodeNames = compactNodes.map((n) => n[1] as string)

        const nodes: NodeTree['nodes'] = {}
        for (const nodeArr of compactNodes) {
            // [type, name, label, [x,y], parent_idx, props, inputs_sparse, ?outputs_sparse]
            const type = (nodeArr[0] as string) ?? ''
            const name = (nodeArr[1] as string) ?? ''
            const label = (nodeArr[2] as string) || name
            const loc = (nodeArr[3] as number[]) ?? [0, 0]
            const parentIdx = (nodeArr[4] as number) ?? -1
            const props = (nodeArr[5] as Record<string, unknown>) ?? {}
            const inputsSparse = (nodeArr[6] as [number, unknown][]) ?? []
            const outputsSparse = nodeArr.length >= 8 ? (nodeArr[7] as [number, unknown][]) : []

            // Expand sparse inputs
            const inputs: unknown[] = []
            for (const [i, v] of inputsSparse) {
                while (inputs.length <= i) inputs.push(null)
                inputs[i] = v
            }

            // Expand sparse outputs
            const outputs: unknown[] = []
            for (const [i, v] of outputsSparse) {
                while (outputs.length <= i) outputs.push(null)
                outputs[i] = v
            }

            nodes[name] = {
                type,
                name,
                label,
                location: { x: Number(loc[0]) || 0, y: Number(loc[1]) || 0 },
                inputs,
                outputs,
                properties: props,
            }

            if (parentIdx >= 0 && parentIdx < nodeNames.length) {
                nodes[name].parent = nodeNames[parentIdx]
            }
        }

        // Expand compact links: [from_idx, from_socket, to_idx, to_socket]
        const links: NodeTree['links'] = []
        for (const linkArr of compactLinks) {
            const fromIdx = linkArr[0] as number
            const fromSock = linkArr[1]
            const toIdx = linkArr[2] as number
            const toSock = linkArr[3]

            const fromSocket = Array.isArray(fromSock) ? (fromSock[1] as string) : (fromSock as string)
            const toSocket = Array.isArray(toSock) ? (toSock[1] as string) : (toSock as string)

            links.push({
                fromNode: (fromIdx >= 0 && fromIdx < nodeNames.length) ? nodeNames[fromIdx] : '',
                fromSocket,
                toNode: (toIdx >= 0 && toIdx < nodeNames.length) ? nodeNames[toIdx] : '',
                toSocket,
            })
        }

        return { nodes, links }
    }

    private zlibDecompress(data: Uint8Array): Uint8Array | null {
        // Try zlib format (with header)
        try {
            const result = inflateSync(data)
            return new Uint8Array(result)
        } catch {
            // Try raw deflate (no header)
            try {
                const result = inflateRawSync(data)
                return new Uint8Array(result)
            } catch {
                return null
            }
        }
    }
}
