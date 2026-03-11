import { create } from 'zustand'
import type { NodeFormat, NodeTree, NodeTreeMetadata } from '@node-runner/shared'

interface NodeState {
    rawInput: string
    detectedFormat: NodeFormat | null
    parsedTree: NodeTree | null
    metadata: NodeTreeMetadata | null

    setRawInput: (input: string) => void
    setDetectedFormat: (format: NodeFormat) => void
    setParsedTree: (tree: NodeTree) => void
    setMetadata: (meta: NodeTreeMetadata) => void
    reset: () => void
}

export const useNodeStore = create<NodeState>((set) => ({
    rawInput: '',
    detectedFormat: null,
    parsedTree: null,
    metadata: null,

    setRawInput: (rawInput) => set({ rawInput }),
    setDetectedFormat: (detectedFormat) => set({ detectedFormat }),
    setParsedTree: (parsedTree) => set({ parsedTree }),
    setMetadata: (metadata) => set({ metadata }),
    reset: () => set({ rawInput: '', detectedFormat: null, parsedTree: null, metadata: null }),
}))

interface AuthState {
    token: string | null
    user: { userId: string; email: string; name: string | null; avatarUrl: string | null; provider: string } | null
    setAuth: (token: string, user: AuthState['user']) => void
    clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => {
    const token = localStorage.getItem('nr_token')
    return {
        token,
        user: null,
        setAuth: (token, user) => {
            localStorage.setItem('nr_token', token)
            set({ token, user })
        },
        clearAuth: () => {
            localStorage.removeItem('nr_token')
            localStorage.removeItem('nr_device_secret')
            set({ token: null, user: null })
        },
    }
})
