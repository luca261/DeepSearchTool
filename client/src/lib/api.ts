/**
 * Central API fetch wrapper.
 * - Injects Authorization: Bearer <token> on every request
 * - Handles 401 → clears token and redirects to /login
 * - Provides typed helpers: api.get / api.post / api.put / api.delete
 */

const TOKEN_KEY = 'auth_token'

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  }
  const token = tokenStorage.get()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    tokenStorage.clear()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(path, {
      method: 'GET',
      headers: getHeaders(),
    })
    return handleResponse<T>(res)
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'PUT',
      headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  delete: async <T>(path: string): Promise<T> => {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    return handleResponse<T>(res)
  },

  /** Raw fetch with auth header (for blob downloads etc.) */
  rawGet: async (path: string): Promise<Response> => {
    const res = await fetch(path, {
      method: 'GET',
      headers: getHeaders(),
    })
    if (res.status === 401) {
      tokenStorage.clear()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    return res
  },
}
