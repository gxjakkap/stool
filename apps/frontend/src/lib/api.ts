/// <reference types="vite/client" />

declare global {
  interface Window {
    ENV?: { VITE_API_ORIGIN?: string }
  }
}

import { treaty } from '@elysiajs/eden'
import type { App } from '@repo/api-types'

const BASE = window.ENV?.VITE_API_ORIGIN || import.meta.env.VITE_API_ORIGIN || window.location.origin

const client = treaty<App>(BASE, {
  fetch: { credentials: 'include' },
})

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await client.api.settings.get()
  if (error) throw new Error('Failed to fetch settings')
  return data
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  const { error } = await client.api.settings.put(settings)
  if (error) throw new Error('Failed to update settings')
}

export async function getTokens(): Promise<Array<{ token: string; label: string; created_at: number }>> {
  const { data, error } = await client.api.tokens.get()
  if (error) throw new Error('Failed to fetch tokens')
  return data
}

export async function createToken(label: string): Promise<{ token: string; label: string; created_at: number }> {
  const { data, error } = await client.api.tokens.post({ label })
  if (error) throw new Error('Failed to create token')
  return data
}

export async function deleteToken(token: string): Promise<void> {
  const { error } = await client.api.tokens({ token }).delete()
  if (error) throw new Error('Failed to delete token')
}

export async function getMe(): Promise<{ sub: string; email?: string; name?: string }> {
  const { data, error } = await client.auth.me.get()
  if (error) throw new Error('Not authenticated')
  return data
}

export async function connectTikTok(): Promise<void> {
  const { error } = await client.api.settings.tiktok.connect.post()
  if (error) throw new Error('Failed to connect to TikTok')
}
