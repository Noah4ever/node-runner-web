// Supported serialization formats
export type NodeFormat = 'hash' | 'json' | 'xml' | 'ai_json'

export const NODE_FORMATS: readonly NodeFormat[] = ['hash', 'json', 'xml', 'ai_json'] as const

export const FORMAT_LABELS: Record<NodeFormat, string> = {
    hash: 'Hash',
    json: 'JSON',
    xml: 'XML',
    ai_json: 'AI JSON',
}

export const FORMAT_DESCRIPTIONS: Record<NodeFormat, string> = {
    hash: 'Smallest format. Stores only the differences from default node values. Ideal for sharing in comments or chat.',
    json: 'Full JSON representation with all node data preserved. Best for archiving and programmatic use.',
    xml: 'XML with type annotations for exact round-trip fidelity between Blender versions.',
    ai_json: 'Compact, human-readable format designed for AI tools to read and generate node trees.',
}

// Node tree domain types
export interface SocketValue {
    index: number
    value: unknown
}

export interface NodeSocket {
    name: string
    type: string
    defaultValue?: unknown
}

export interface NodeLink {
    fromNode: string
    fromSocket: string
    toNode: string
    toSocket: string
}

export interface NodePosition {
    x: number
    y: number
}

export interface NodeData {
    type: string
    name: string
    label: string
    location: NodePosition
    parent?: string
    inputs: unknown[]
    outputs: unknown[]
    properties: Record<string, unknown>
}

export interface NodeTree {
    nodes: Record<string, NodeData>
    links: NodeLink[]
}

// Metadata extracted during parsing
export interface NodeTreeMetadata {
    nodeCount: number
    linkCount: number
    nodeTypes: string[]
    hasGroups: boolean
    format: NodeFormat
    warnings: string[]
}

// Inspection result
export interface InspectionResult {
    tree: NodeTree
    metadata: NodeTreeMetadata
    raw: string
    format: NodeFormat
}

// Diff types
export interface DiffChange {
    path: string
    type: 'added' | 'removed' | 'modified'
    oldValue?: unknown
    newValue?: unknown
}

export interface DiffResult {
    nodesAdded: string[]
    nodesRemoved: string[]
    nodesModified: string[]
    linksAdded: NodeLink[]
    linksRemoved: NodeLink[]
    changes: DiffChange[]
    summary: string
}

// Licenses uploads can be tagged with. Defaults to CC BY 4.0 when omitted.
// "arr" = all rights reserved.
export type NodeLicense = 'cc0' | 'cc-by-4.0' | 'cc-by-sa-4.0' | 'cc-by-nc-4.0' | 'mit' | 'arr'

export const NODE_LICENSES: readonly NodeLicense[] = [
    'cc-by-4.0', 'cc0', 'cc-by-sa-4.0', 'cc-by-nc-4.0', 'mit', 'arr',
] as const

export const DEFAULT_LICENSE: NodeLicense = 'cc-by-4.0'

export interface LicenseInfo {
    label: string
    short: string
    url: string
    blurb: string
}

export const LICENSE_INFO: Record<NodeLicense, LicenseInfo> = {
    'cc-by-4.0': {
        label: 'Creative Commons Attribution 4.0',
        short: 'CC BY 4.0',
        url: 'https://creativecommons.org/licenses/by/4.0/',
        blurb: 'Anyone can use, modify, and redistribute, as long as they credit you.',
    },
    'cc0': {
        label: 'Creative Commons Zero (Public Domain)',
        short: 'CC0',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        blurb: 'No rights reserved. Anyone can use, modify, and redistribute without crediting you.',
    },
    'cc-by-sa-4.0': {
        label: 'Creative Commons Attribution-ShareAlike 4.0',
        short: 'CC BY-SA 4.0',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        blurb: 'Credit required. Derivatives must use the same license.',
    },
    'cc-by-nc-4.0': {
        label: 'Creative Commons Attribution-NonCommercial 4.0',
        short: 'CC BY-NC 4.0',
        url: 'https://creativecommons.org/licenses/by-nc/4.0/',
        blurb: 'Credit required. Non-commercial use only.',
    },
    'mit': {
        label: 'MIT License',
        short: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
        blurb: 'Use freely, including commercially. Include the license notice in redistributions.',
    },
    'arr': {
        label: 'All Rights Reserved',
        short: 'All rights reserved',
        url: '',
        blurb: 'No reuse permitted without your explicit permission.',
    },
}

// Shared page / share types
export interface SharedNodePage {
    id: string
    slug: string
    title: string
    description: string
    sourceFormat: NodeFormat
    originalContent: string
    normalizedContent?: string
    metadata: NodeTreeMetadata
    isPublic: boolean
    previewColor?: string
    tags: string[]
    authorId?: string
    createdAt: string
    updatedAt: string
}

// User
export interface UserProfile {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    provider: string
    createdAt: string
}

// API response envelope
export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
    }
}
