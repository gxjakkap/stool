import { useState, useEffect, useCallback } from 'react'

// ─── Singleton emote map ──────────────────────────────────────────────────────
// Populated by the backend via { type: 'emotes', emotes: [...] } WS messages.

const emoteMap = new Map<string, string>() // code → image URL

const subscribers = new Set<() => void>()
function notify() {
  subscribers.forEach(fn => fn())
}

export function handleEmotesMessage(emotes: Array<{ code: string; url: string }>) {
  let changed = false
  for (const e of emotes) {
    if (emoteMap.get(e.code) !== e.url) {
      emoteMap.set(e.code, e.url)
      changed = true
    }
  }
  if (changed) notify()
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseMessage(text: string): string {
  return text.split(/(\s+)/).map(token => {
    if (/^\s+$/.test(token)) return token
    const url = emoteMap.get(token)
    if (!url) return escapeHtml(token)
    const safe = escapeHtml(token)
    return `<img alt="${safe}" title="${safe}" class="twitch-emote inline-block align-middle h-6" src="${url}">`
  }).join('')
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEmoteParser() {
  const [, setVersion] = useState(0)

  useEffect(() => {
    const bump = () => setVersion(v => v + 1)
    subscribers.add(bump)
    return () => { subscribers.delete(bump) }
  }, [])

  const parse = useCallback((text: string) => parseMessage(text), [])
  return { parse }
}
