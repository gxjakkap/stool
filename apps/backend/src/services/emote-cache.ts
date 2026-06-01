import { EmoteFetcher } from '@mkody/twitch-emoticons'
import { getSetting } from '../db/client'
import type { EmoteInfo } from '../types'

type EmoteCallback = (emotes: EmoteInfo[]) => void

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEmoteInfo(fetcher: EmoteFetcher): EmoteInfo[] {
  const result: EmoteInfo[] = []
  for (const emote of (fetcher as any).emotes.values()) {
    try {
      const url = (emote as any).toLink(1) as string
      if (url) result.push({ code: (emote as any).code, url })
    } catch { /* skip */ }
  }
  return result
}

// ─── EmoteCache ───────────────────────────────────────────────────────────────

class EmoteCache {
  private fetcher  = new EmoteFetcher()
  private initPromise: Promise<void> | null = null
  private initialized = false
  private cachedEmotes: EmoteInfo[] = []
  private subscribers = new Set<EmoteCallback>()

  subscribe(fn: EmoteCallback): () => void {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }

  private notify() {
    for (const fn of this.subscribers) {
      try { fn(this.cachedEmotes) } catch { /* ignore */ }
    }
  }

  isInitialized(): boolean { return this.initialized }
  getEmotes(): EmoteInfo[]  { return this.cachedEmotes }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      const clientId     = getSetting('twitch_client_id')     ?? ''
      const clientSecret = getSetting('twitch_client_secret') ?? ''
      const channelName  = getSetting('twitch_channel')       ?? ''
      const hasCreds     = !!(clientId && clientSecret)

      this.fetcher = hasCreds
        ? new EmoteFetcher(clientId, clientSecret)
        : new EmoteFetcher()

      // ── Global emotes (BTTV / FFZ / 7TV / Twitch global) ──────────────────
      await Promise.allSettled([
        this.fetcher.fetchBTTVEmotes()     .catch((e: any) => console.warn('[EmoteCache] BTTV global:',   e?.message)),
        this.fetcher.fetchFFZEmotes()      .catch((e: any) => console.warn('[EmoteCache] FFZ global:',    e?.message)),
        this.fetcher.fetchSevenTVEmotes()  .catch((e: any) => console.warn('[EmoteCache] 7TV global:',    e?.message)),
        ...(hasCreds
          ? [this.fetcher.fetchTwitchEmotes().catch((e: any) => console.warn('[EmoteCache] Twitch global:', e?.message))]
          : []),
      ])

      // ── Configured channel emotes ──────────────────────────────────────────
      if (hasCreds && channelName) {
        try {
          const user = await (this.fetcher as any).apiClient.users.getUserByName(channelName)
          if (user) {
            const numId = parseInt(user.id, 10)
            await Promise.allSettled([
              this.fetcher.fetchBTTVEmotes(numId)    .catch((e: any) => console.warn('[EmoteCache] BTTV channel:',   e?.message)),
              this.fetcher.fetchFFZEmotes(numId)     .catch((e: any) => console.warn('[EmoteCache] FFZ channel:',    e?.message)),
              this.fetcher.fetchSevenTVEmotes(numId) .catch((e: any) => console.warn('[EmoteCache] 7TV channel:',    e?.message)),
              this.fetcher.fetchTwitchEmotes(numId)  .catch((e: any) => console.warn('[EmoteCache] Twitch channel:', e?.message)),
            ])
          }
        } catch (e: any) {
          console.warn('[EmoteCache] Could not resolve channel:', e?.message)
        }
      }

      // Collect from the flat fetcher.emotes map (global + channel merged)
      this.cachedEmotes = toEmoteInfo(this.fetcher)
      this.initialized  = true
      console.log(`[EmoteCache] Ready — ${this.cachedEmotes.length} emotes total`)
      this.notify()
    })()

    return this.initPromise
  }
}

export const emoteCache = new EmoteCache()
