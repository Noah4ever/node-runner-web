import type { NodeFormat, NodeTree } from '@node-runner/shared'

export interface FormatDetector {
    detect(input: string): { format: NodeFormat; confidence: number }
}

export interface Parser {
    parse(input: string, format: NodeFormat): NodeTree
}

export interface Serializer {
    serialize(tree: NodeTree, format: NodeFormat): string
}

export interface Converter {
    convert(input: string, sourceFormat: NodeFormat, targetFormat: NodeFormat): string
}

export interface Validator {
    validate(input: string, format: NodeFormat): {
        valid: boolean
        errors: string[]
        warnings: string[]
    }
}
