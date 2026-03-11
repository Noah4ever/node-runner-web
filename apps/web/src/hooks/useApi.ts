import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNodeStore, useAuthStore } from '@/stores/nodeStore'
import type { NodeFormat, NodeTree } from '@node-runner/shared'

export function useDetectFormat() {
    const { setDetectedFormat } = useNodeStore()

    return useMutation({
        mutationFn: (input: string) => api.detectFormat(input),
        onSuccess: (data) => {
            setDetectedFormat(data.format as NodeFormat)
        },
    })
}

export function useInspect() {
    const { setDetectedFormat, setParsedTree, setMetadata } = useNodeStore()

    return useMutation({
        mutationFn: (input: string) => api.inspect(input),
        onSuccess: (data) => {
            setDetectedFormat(data.format as NodeFormat)
            if (data.tree) setParsedTree(data.tree as unknown as NodeTree)
            if (data.metadata) setMetadata(data.metadata as never)
        },
    })
}

export function useValidate() {
    return useMutation({
        mutationFn: ({ input, format }: { input: string; format?: string }) => api.validate(input, format),
    })
}

export function useConvert() {
    return useMutation({
        mutationFn: ({ input, targetFormat, sourceFormat }: { input: string; targetFormat: string; sourceFormat?: string }) =>
            api.convert(input, targetFormat, sourceFormat),
    })
}

export function useDiff() {
    return useMutation({
        mutationFn: ({ left, right }: { left: string; right: string }) => api.diff(left, right),
    })
}

export function useCreateShare() {
    return useMutation({
        mutationFn: (data: { title: string; content: string; format: string; description?: string; isPublic?: boolean; tags?: string[]; images?: string[] }) =>
            api.createShare(data),
    })
}

export function useGetShare<T = Record<string, unknown>>(id: string) {
    return useQuery({
        queryKey: ['share', id],
        queryFn: () => api.getShare(id) as Promise<T>,
        enabled: !!id,
    })
}

export function useListShares() {
    return useQuery({
        queryKey: ['shares'],
        queryFn: () => api.listShares(),
    })
}

export function useMyShares() {
    const { token } = useAuthStore()
    return useQuery({
        queryKey: ['shares', 'my'],
        queryFn: () => api.myShares(),
        enabled: !!token,
    })
}

export function useDeleteShare() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.deleteShare(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shares'] })
        },
    })
}

export function useUpdateShare() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string; content?: string; tags?: string[]; images?: string[] } }) =>
            api.updateShare(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shares'] })
        },
    })
}

export function useToggleLike() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.toggleLike(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shares'] })
            queryClient.invalidateQueries({ queryKey: ['share'] })
        },
    })
}

export function useToggleSave() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.toggleSave(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shares'] })
            queryClient.invalidateQueries({ queryKey: ['share'] })
        },
    })
}

export function useSavedShares() {
    const { token } = useAuthStore()
    return useQuery({
        queryKey: ['shares', 'saved'],
        queryFn: () => api.savedShares(),
        enabled: !!token,
    })
}

export function useLikedShares() {
    const { token } = useAuthStore()
    return useQuery({
        queryKey: ['shares', 'liked'],
        queryFn: () => api.likedShares(),
        enabled: !!token,
    })
}

export function useUserShares(userId: string) {
    return useQuery({
        queryKey: ['shares', 'user', userId],
        queryFn: () => api.userShares(userId),
        enabled: !!userId,
    })
}

export function useGetUser(userId: string) {
    return useQuery({
        queryKey: ['user', userId],
        queryFn: () => api.getUser(userId),
        enabled: !!userId,
    })
}

export function useToggleBan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (userId: string) => api.toggleBan(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] })
        },
    })
}

export function useAuth() {
    const { token, setAuth, clearAuth } = useAuthStore()
    const queryClient = useQueryClient()

    const meQuery = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: () => api.getMe(),
        enabled: !!token,
        retry: false,
    })

    return {
        user: meQuery.data ?? null,
        isLoading: meQuery.isLoading,
        isLoggedIn: !!meQuery.data,
        login: async (data: { provider: string; email: string; providerId: string; name?: string }) => {
            const result = await api.login(data)
            setAuth(result.token, result.user as never)
            await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
            return result
        },
        adminLogin: async (data: { email: string; password: string }) => {
            const result = await api.adminLogin(data)
            setAuth(result.token, result.user as never)
            await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
            return result
        },
        logout: async () => {
            await api.logout().catch(() => { })
            clearAuth()
            queryClient.removeQueries({ queryKey: ['auth', 'me'] })
        },
    }
}
