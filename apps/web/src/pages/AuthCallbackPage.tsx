import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/nodeStore'
import { useQueryClient } from '@tanstack/react-query'

export function AuthCallbackPage() {
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const { setAuth } = useAuthStore()
    const queryClient = useQueryClient()

    useEffect(() => {
        const token = params.get('token')
        if (token) {
            setAuth(token, null)
            queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }).then(() => {
                navigate('/profile', { replace: true })
            })
        } else {
            navigate('/signin?error=oauth_failed', { replace: true })
        }
    }, [params, setAuth, queryClient, navigate])

    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-sm text-[var(--color-text-muted)]">Signing you in...</p>
        </div>
    )
}
