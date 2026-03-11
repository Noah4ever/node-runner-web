import type { NodeFormat } from '@node-runner/shared'
import type { Converter } from '../types/index.js'
import { DefaultFormatDetector } from '../parsers/format-detector.js'
import { PlaceholderParser } from '../parsers/parser.js'

// TODO: Implement real conversion by parsing into NodeTree, then serializing
// to the target format. This requires full serializer implementations.

export class PlaceholderConverter implements Converter {
    private detector = new DefaultFormatDetector()
    private parser = new PlaceholderParser()

    convert(input: string, sourceFormat: NodeFormat, targetFormat: NodeFormat): string {
        if (sourceFormat === targetFormat) {
            return input
        }

        const tree = this.parser.parse(input, sourceFormat)

        // TODO: Serialize tree to targetFormat using real serializers
        switch (targetFormat) {
            case 'json':
                return JSON.stringify({ nodes: tree.nodes, links: tree.links }, null, 2)
            case 'ai_json':
                return JSON.stringify({ nodes: tree.nodes, links: tree.links }, null, 2)
            case 'xml':
                return `<!-- TODO: XML serialization -->\n<node_tree />`
            case 'hash':
                return `<!-- TODO: Hash encoding -->`
        }
    }
}
