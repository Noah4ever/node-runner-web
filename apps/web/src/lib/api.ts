import type { ApiResponse } from '@node-runner/shared'

const BASE_URL = '/api/v1'

function getAuthToken(): string | null {
  return localStorage.getItem('nr_token')
}

function getDeviceId(): string {
  let id = localStorage.getItem('nr_device_secret')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('nr_device_secret', id)
  }
  return id
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  headers['X-Device-Id'] = getDeviceId()

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  })

  const body: ApiResponse<T> = await res.json()

  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? 'Request failed')
  }

  return body.data
}

export const api = {
  detectFormat: (input: string) =>
    request<{ format: string; confidence: number }>('/parse/detect-format', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  validate: (input: string, format?: string) =>
    request<{ valid: boolean; format: string; errors: string[]; warnings: string[] }>('/validate', {
      method: 'POST',
      body: JSON.stringify({ input, format }),
    }),

  inspect: (input: string, format?: string) =>
    request<{ tree: Record<string, unknown>; metadata: Record<string, unknown>; format: string }>(
      '/inspect',
      {
        method: 'POST',
        body: JSON.stringify({ input, format }),
      },
    ),

  convert: (input: string, targetFormat: string, sourceFormat?: string) =>
    request<{ output: string; sourceFormat: string; targetFormat: string }>('/convert', {
      method: 'POST',
      body: JSON.stringify({ input, targetFormat, sourceFormat }),
    }),

  diff: (left: string, right: string) =>
    request<Record<string, unknown>>('/diff', {
      method: 'POST',
      body: JSON.stringify({ left, right }),
    }),

  createShare: (data: {
    title: string
    content: string
    format: string
    description?: string
    isPublic?: boolean
    tags?: string[]
    images?: string[]
  }) =>
    request<Record<string, unknown>>('/share', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShare: (id: string) => request<Record<string, unknown>>(`/share/${encodeURIComponent(id)}`),

  listShares: () => request<Record<string, unknown>[]>('/share'),

  myShares: () => request<Record<string, unknown>[]>('/share/my'),

  deleteShare: (id: string) =>
    request<{ deleted: boolean }>(`/share/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  updateShare: (
    id: string,
    data: {
      title?: string
      description?: string
      content?: string
      tags?: string[]
      images?: string[]
    },
  ) =>
    request<Record<string, unknown>>(`/share/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleLike: (id: string) =>
    request<{ liked: boolean; likes: number }>(`/share/${encodeURIComponent(id)}/like`, {
      method: 'POST',
    }),

  toggleSave: (id: string) =>
    request<{ saved: boolean }>(`/share/${encodeURIComponent(id)}/save`, {
      method: 'POST',
    }),

  savedShares: () => request<Record<string, unknown>[]>('/share/saved'),

  likedShares: () => request<Record<string, unknown>[]>('/share/liked'),

  userShares: (userId: string) =>
    request<Record<string, unknown>[]>(`/share/user/${encodeURIComponent(userId)}`),

  // Auth
  providers: () => request<{ providers: string[] }>('/auth/providers'),

  getMe: () =>
    request<{
      userId: string
      email: string
      name: string | null
      avatarUrl: string | null
      provider: string
      isAdmin?: boolean
    }>('/auth/me'),

  login: (data: {
    provider: string
    email: string
    providerId: string
    name?: string
    avatarUrl?: string
  }) =>
    request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adminLogin: (data: { email: string; password: string }) =>
    request<{ token: string; user: Record<string, unknown> }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUser: (userId: string) =>
    request<{ id: string; name: string | null; avatarUrl: string | null; createdAt: string }>(
      `/auth/user/${encodeURIComponent(userId)}`,
    ),

  toggleBan: (userId: string) =>
    request<{ banned: boolean }>(`/auth/admin/ban/${encodeURIComponent(userId)}`, {
      method: 'POST',
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
}
