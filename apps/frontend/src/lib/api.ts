/// <reference types="vite/client" />

declare global {
  interface Window {
    ENV?: { VITE_API_ORIGIN?: string }
  }
}

import { treaty } from '@elysiajs/eden'
import type { App } from '@repo/api-types'

export const BASE = window.ENV?.VITE_API_ORIGIN || import.meta.env.VITE_API_ORIGIN || window.location.origin

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

// ── Bot ──────────────────────────────────────────────────────────────────────

export type BotPlatform = 'twitch' | 'kick'
export type BotRole = 'bot' | 'broadcaster'

export interface BotCommand {
  trigger: string
  response: string
  prefixUser: boolean
}

export interface BotTimer {
  id: number
  message: string
  intervalMinutes: number
  minLines: number
  platforms: BotPlatform[]
  enabled: boolean
}

const errorOf = (error: { value: unknown } | null, fallback: string) => {
  const v = error?.value as { error?: string; message?: string } | string | undefined
  return new Error((typeof v === 'string' ? v : v?.error ?? v?.message) || fallback)
}

export async function getCommands(): Promise<BotCommand[]> {
  const { data, error } = await client.api.commands.get()
  if (error) throw errorOf(error, 'Failed to fetch commands')
  return data
}

export async function getPublicCommands(): Promise<{ trigger: string; response: string | null }[]> {
  const { data, error } = await client.api.commands.public.get()
  if (error) throw errorOf(error, 'Failed to fetch commands')
  return data
}

export async function createCommand(cmd: BotCommand): Promise<void> {
  const { error } = await client.api.commands.post(cmd)
  if (error) throw errorOf(error, 'Failed to create command')
}

export async function updateCommand(cmd: BotCommand): Promise<void> {
  const { error } = await client.api.commands.put(cmd)
  if (error) throw errorOf(error, 'Failed to update command')
}

export async function removeCommand(trigger: string): Promise<void> {
  const { error } = await client.api.commands.delete(undefined, { query: { trigger } })
  if (error) throw errorOf(error, 'Failed to delete command')
}

export async function testCommand(response: string, user: string, args: string[]): Promise<{ output?: string; error?: string }> {
  const { data, error } = await client.api.commands.test.post({ response, user, args })
  if (error) throw errorOf(error, 'Failed to test command')
  return data
}

export async function getTimers(): Promise<BotTimer[]> {
  const { data, error } = await client.api.timers.get()
  if (error) throw errorOf(error, 'Failed to fetch timers')
  return data
}

export async function createTimer(timer: Omit<BotTimer, 'id'>): Promise<number> {
  const { data, error } = await client.api.timers.post(timer)
  if (error) throw errorOf(error, 'Failed to create timer')
  return data.id
}

export async function updateTimer({ id, ...timer }: BotTimer): Promise<void> {
  const { error } = await client.api.timers({ id }).put(timer)
  if (error) throw errorOf(error, 'Failed to update timer')
}

export async function removeTimer(id: number): Promise<void> {
  const { error } = await client.api.timers({ id }).delete()
  if (error) throw errorOf(error, 'Failed to delete timer')
}

export async function getBotStatus() {
  const { data, error } = await client.api.bot.status.get()
  if (error) throw errorOf(error, 'Failed to fetch bot status')
  return data
}

/** Full-page navigation: the OAuth flow leaves the SPA and returns to /settings. */
export const botConnectUrl = (platform: BotPlatform, role: BotRole) => `${BASE}/api/bot/oauth/${platform}/${role}/start`

export async function disconnectBotAccount(platform: BotPlatform, role: BotRole): Promise<void> {
  const { error } = await client.api.bot.oauth({ platform })({ role }).disconnect.post()
  if (error) throw errorOf(error, 'Failed to disconnect')
}
