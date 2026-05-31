import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChat, type ChatMessage } from '@/lib/ws'
import { PlatformBadge } from '@/components/PlatformBadge'
import { ChatBadges } from '@/components/ChatBadges'
import { cn } from '@/lib/utils'

interface OverlayMessage extends ChatMessage {
  expireAt: number
  exiting: boolean
}

const DEFAULT_EXPIRE = 30
const DEFAULT_MAX = 20
const DEFAULT_FONT_SIZE = 16

export default function Overlay() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? undefined
  const expireSeconds = Number(searchParams.get('expire') ?? DEFAULT_EXPIRE)
  const maxMessages = Number(searchParams.get('max') ?? DEFAULT_MAX)
  const fontSize = Number(searchParams.get('fontSize') ?? DEFAULT_FONT_SIZE)
  const animSpeed = searchParams.get('anim') ?? 'normal'
  const theme = searchParams.get('theme') ?? 'dark'

  const { messages } = useChat(token)
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([])
  const processedIds = useRef(new Set<string>())

  // Set transparent background for OBS
  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  // Add new messages
  useEffect(() => {
    const newMsgs = messages.filter((m) => !processedIds.current.has(m.id))
    if (newMsgs.length === 0) return

    for (const m of newMsgs) processedIds.current.add(m.id)

    setOverlayMessages((prev) => {
      const next: OverlayMessage[] = [
        ...prev,
        ...newMsgs.map((m) => ({
          ...m,
          // Use Infinity for no expiration when expireSeconds <= 0
          expireAt: expireSeconds > 0 ? Date.now() + expireSeconds * 1000 : Infinity,
          exiting: false,
        })),
      ].slice(-maxMessages)
      return next
    })
  }, [messages, expireSeconds, maxMessages])

  // Expire messages on a timer
  useEffect(() => {
    // Optimization: avoid interval if no expiration is configured
    if (expireSeconds <= 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now()
      setOverlayMessages((prev) => {
        // Mark as exiting
        const updated = prev.map((m) =>
          !m.exiting && m.expireAt <= now ? { ...m, exiting: true } : m
        )
        // Remove fully expired messages (after animation ~600ms)
        return updated.filter((m) => !m.exiting || m.expireAt > now - 700)
      })
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const animDuration =
    animSpeed === 'slow' ? '0.5s' : animSpeed === 'fast' ? '0.15s' : '0.3s'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex flex-col-reverse gap-1.5 p-3"
      style={{ fontSize: `${fontSize}px`, background: 'transparent' }}
    >
      {[...overlayMessages].reverse().map((msg) => (
        <div
          key={msg.id}
          className={cn(
            'flex flex-col gap-0.5 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm',
            theme === 'light'
              ? 'bg-white/90 text-black'
              : 'bg-black/80 text-white',
            msg.exiting ? 'msg-expire' : 'msg-enter'
          )}
          style={{ animationDuration: animDuration }}
        >
          <div className="flex items-center gap-2">
            <PlatformBadge platform={msg.platform} size="sm" />
            <div className="flex items-center gap-1.5">
              <ChatBadges badges={msg.badges} size="sm" />
              <span
                className={cn(
                  'text-sm font-semibold leading-none',
                  theme === 'light' && !msg.userColor && 'text-zinc-800'
                )}
                style={msg.userColor ? { color: msg.userColor } : undefined}
              >
                {msg.displayName}
              </span>
            </div>
          </div>
          <p
            className={cn(
              'text-sm leading-snug',
              theme === 'light' ? 'text-black/90' : 'text-white/90'
            )}
          >
            {msg.message}
          </p>
        </div>
      ))}
    </div>
  )
}
