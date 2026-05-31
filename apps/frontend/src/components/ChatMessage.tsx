import { cn } from '@/lib/utils'
import { PlatformBadge } from './PlatformBadge'
import { ChatBadges } from './ChatBadges'
import type { ChatMessage as ChatMessageType } from '@/lib/ws'

interface ChatMessageProps {
  message: ChatMessageType
  className?: string
  compact?: boolean
}

export function ChatMessage({ message, className, compact = false }: ChatMessageProps) {
  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'group flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors',
        'hover:bg-white/5',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <PlatformBadge platform={message.platform} />
        <div className="flex items-center gap-1.5">
          <ChatBadges badges={message.badges} size="sm" />
          <span
            className="text-sm font-semibold leading-none"
            style={{ color: message.userColor ?? 'hsl(var(--foreground))' }}
          >
            {message.displayName}
          </span>
        </div>
        {!compact && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100">
            {timeStr}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[hsl(var(--foreground)/0.9)]">{message.message}</p>
    </div>
  )
}
