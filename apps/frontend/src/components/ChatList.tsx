import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import type { ChatMessage as ChatMessageType } from '@/lib/ws'
import { cn } from '@/lib/utils'

interface ChatListProps {
  messages: ChatMessageType[]
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
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
