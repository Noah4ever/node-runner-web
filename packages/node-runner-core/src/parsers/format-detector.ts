import type { NodeFormat } from '@node-runner/shared'
import type { FormatDetector } from '../types/index.js'

export class DefaultFormatDetector implements FormatDetector {
    detect(input: string): { format: NodeFormat; confidence: number } {
        const trimmed = input.trim()

        if (!trimmed) {
            return { format: 'hash', confidence: 0 }
        }

        // XML: starts with <
        if (trimmed.startsWith('<')) {
            return { format: 'xml', confidence: 0.9 }
        }

        // JSON variants: starts with { or [
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed)
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                    if (this.isAiJson(parsed)) {
                        return { format: 'ai_json', confidence: 0.85 }
                    }
                    if (parsed.nodes && typeof parsed.nodes === 'object') {
                        return { format: 'json', confidence: 0.85 }
                    }
                }
                return { format: 'json', confidence: 0.3 }
            } catch {
                return { format: 'json', confidence: 0.3 }
            }
        }

        // Hash: contains the __NR separator (e.g. "MyNodes__NReNq...base64...")
        if (trimmed.includes('__NR')) {
            return { format: 'hash', confidence: 0.95 }
        }

        // Fallback: base64-like string
        if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 20) {
            return { format: 'hash', confidence: 0.5 }
        }

        return { format: 'hash', confidence: 0.1 }
    }

    /** Mirror Python's _is_ai_json: AI JSON uses dict inputs; regular JSON uses list inputs */
    private isAiJson(data: Record<string, unknown>): boolean {
        // Legacy compact format
        if ('v' in data && 'n' in data) return true
        const nodes = data.nodes
        if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes)) return false
        const entries = Object.values(nodes as Record<string, unknown>)
        if (entries.length === 0) return false
        const first = entries[0]
        if (!first || typeof first !== 'object' || !('type' in (first as Record<string, unknown>))) return false
        const inputs = (first as Record<string, unknown>).inputs
        // AI JSON uses dict inputs; regular JSON uses list inputs
        return inputs === undefined || (typeof inputs === 'object' && !Array.isArray(inputs))
    }
}
