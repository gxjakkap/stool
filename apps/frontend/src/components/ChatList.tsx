import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import { TikTokEventBubble } from './TikTokEventBubble'
import type { WsMessage } from '@/lib/ws'
import { cn } from '@/lib/utils'

interface ChatListProps {
  messages: WsMessage[]
  className?: string
  autoScroll?: boolean
}

export function ChatList({ messages, className, autoScroll = true }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll])

  return (
    <div className={cn('flex flex-col gap-1 overflow-y-auto', className)}>
      {messages.map((msg) => {
        if (msg.type === 'system_status' || msg.type === 'donation') return null;
        if (msg.type === 'tiktok_event') return <TikTokEventBubble key={msg.id} event={msg} />;
        return <ChatMessage key={msg.id} message={msg} />;
      })}
      <div ref={bottomRef} />
    </div>
  )
}
