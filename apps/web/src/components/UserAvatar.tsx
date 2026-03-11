import { Link } from 'react-router-dom'

interface UserAvatarProps {
    name: string
    avatarUrl?: string | null
    userId?: string | null
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-14 w-14 text-xl',
}

export function UserAvatar({ name, avatarUrl, userId, size = 'md', className = '' }: UserAvatarProps) {
    const sizeClass = sizes[size]
    const initial = (name || '?').charAt(0).toUpperCase()

    const avatar = avatarUrl ? (
        <img
            src={avatarUrl}
            alt={name}
            className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
            referrerPolicy="no-referrer"
        />
    ) : (
        <div className={`flex items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-bold shrink-0 ${sizeClass} ${className}`}>
            {initial}
        </div>
    )

    if (userId) {
        return (
            <Link to={`/user/${userId}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {avatar}
            </Link>
        )
    }

    return avatar
}
