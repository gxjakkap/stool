const BASE = '' // proxied via Vite dev server

export async function getSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/api/settings`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  const res = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to update settings')
}

export async function getTokens(): Promise<Array<{ token: string; label: string; created_at: number }>> {
  const res = await fetch(`${BASE}/api/tokens`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch tokens')
  return res.json()
}

export async function createToken(label: string): Promise<{ token: string; label: string; created_at: number }> {
  const res = await fetch(`${BASE}/api/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ label }),
  })
  if (!res.ok) throw new Error('Failed to create token')
  return res.json()
}

export async function deleteToken(token: string): Promise<void> {
  const res = await fetch(`${BASE}/api/tokens/${token}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to delete token')
}

export async function getMe(): Promise<{ sub: string; email?: string; name?: string }> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: 'include' })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}
