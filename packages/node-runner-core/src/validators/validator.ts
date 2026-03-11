import type { NodeFormat } from '@node-runner/shared'
import type { Validator } from '../types/index.js'

// TODO: Implement real validation per format.
// Hash: check base64 validity, try decompress
// JSON/AI JSON: parse and check structure
// XML: parse and check schema

export class PlaceholderValidator implements Validator {
    validate(
        input: string,
        format: NodeFormat,
    ): { valid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = []
        const warnings: string[] = []

        if (!input.trim()) {
            return { valid: false, errors: ['Input is empty'], warnings }
        }

        switch (format) {
            case 'json':
            case 'ai_json':
                try {
                    JSON.parse(input)
                } catch {
                    errors.push('Invalid JSON syntax')
                }
                break
            case 'xml':
                if (!input.trim().startsWith('<')) {
                    errors.push('Input does not appear to be valid XML')
                }
                break
            case 'hash':
                if (!/^[A-Za-z0-9+/=\s]+$/.test(input.trim())) {
                    errors.push('Input contains invalid base64 characters')
                }
                break
        }

        return { valid: errors.length === 0, errors, warnings }
    }
}
