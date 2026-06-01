/// <reference types="vite/client" />

import { useEffect, useRef, useState, useCallback } from 'react'
import { handleEmotesMessage } from './emotes'

export interface ChatMessage {
  id: string
  type?: 'chat'
  platform: 'twitch' | 'youtube' | 'tiktok'
  username: string
  displayName: string
  message: string
  timestamp: number
  userColor?: string
  badges?: string[]
}

export type TikTokEventKind = 'gift' | 'follow' | 'share'

export interface TikTokEventMessage {
  id: string
  type: 'tiktok_event'
  platform: 'tiktok'
  kind: TikTokEventKind
  username: string
  displayName: string
  timestamp: number
  giftName?: string
  giftCount?: number
  giftDiamonds?: number
  giftImageUrl?: string
}

export type WsMessage = ChatMessage | TikTokEventMessage

function getWsUrl() {
  const origin = window.ENV?.VITE_API_ORIGIN || import.meta.env.VITE_API_ORIGIN || window.location.origin
  const url = new URL(origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${url.origin}/ws`
}

export function useChat(token?: string) {
  const [messages, setMessages] = useState<WsMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const unauthorizedRef = useRef(false)

  const connect = useCallback(() => {
    if (!mountedRef.current || unauthorizedRef.current) return
    const url = token ? `${getWsUrl()}?token=${token}` : getWsUrl()
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      console.log('[WS] Connected')
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data as string)
        // Emote dictionary push from backend
        if (msg.type === 'emotes') {
          handleEmotesMessage(msg.emotes)
          return
        }
        if (msg.error === 'Unauthorized') {
          console.error('[WS] Unauthorized. Stopping reconnects.')
          unauthorizedRef.current = true
          if (reconnectRef.current) clearTimeout(reconnectRef.current)
          ws.close()
          return
        }
        if (msg.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg as WsMessage]
          })
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      if (unauthorizedRef.current) return
      console.log('[WS] Disconnected, reconnecting in 3s...')
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = (e) => {
      console.error('[WS] Error:', e)
    }
  }, [token])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      wsRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, connected, clearMessages }
}
