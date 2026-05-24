import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

// Convenience SPA route - redirects /share/:id/import to the raw API endpoint
// which serves the node-tree content as plain text with the correct
// Content-Type per format. The canonical addon URL is the API URL itself.
export function SharedRawPage() {
    const { id } = useParams<{ id: string }>()

    useEffect(() => {
        if (!id) return
        window.location.replace(`/api/v1/share/${encodeURIComponent(id)}/raw`)
    }, [id])

    return null
}
