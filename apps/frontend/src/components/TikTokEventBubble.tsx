import { cn } from '@/lib/utils'
import type { TikTokEventMessage } from '@/lib/ws'
import { Gift, UserPlus, Share2 } from 'lucide-react'

interface TikTokEventBubbleProps {
  event: TikTokEventMessage
  className?: string
  /** When true, omit the timestamp hover label (used in overlay) */
  compact?: boolean
  /** Overlay theme */
  theme?: 'dark' | 'light'
}

const KIND_CONFIG = {
  gift: {
    icon: Gift,
    accentClass: 'text-[#ff6b6b]',
    bgClass: 'bg-[#ff6b6b]/10 border border-[#ff6b6b]/20',
    label: 'sent a gift',
  },
  follow: {
    icon: UserPlus,
    accentClass: 'text-[#51cf66]',
    bgClass: 'bg-[#51cf66]/10 border border-[#51cf66]/20',
    label: 'followed',
  },
  share: {
    icon: Share2,
    accentClass: 'text-[#339af0]',
    bgClass: 'bg-[#339af0]/10 border border-[#339af0]/20',
    label: 'shared the stream',
  },
} as const

export function TikTokEventBubble({
  event,
  className,
  compact = false,
  theme,
}: TikTokEventBubbleProps) {
  const config = KIND_CONFIG[event.kind]
  const Icon = config.icon

  const timeStr = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors',
        config.bgClass,
        // In non-theme (Chat page) mode, add hover
        !theme && 'hover:brightness-110',
        className
      )}
    >
      {/* Event icon */}
      <span className={cn('mt-0.5 shrink-0', config.accentClass)}>
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Name + action */}
        <p className={cn('text-sm leading-snug', theme === 'light' ? 'text-black/90' : 'text-white/90')}>
          <span className={cn('font-semibold', config.accentClass)}>
            {event.displayName}
          </span>{' '}
          <span className={theme === 'light' ? 'text-black/70' : 'text-white/60'}>
            {config.label}
          </span>
        </p>

        {/* Gift detail row */}
        {event.kind === 'gift' && (
          <div className="mt-1 flex items-center gap-2">
            {event.giftImageUrl && (
              <img
                src={event.giftImageUrl}
                alt={event.giftName ?? 'gift'}
                className="h-6 w-6 rounded object-contain"
              />
            )}
            <span className={cn('text-sm font-medium', config.accentClass)}>
              {event.giftName ?? 'Gift'}
            </span>
            {(event.giftCount ?? 1) > 1 && (
              <span className={cn('text-xs', theme === 'light' ? 'text-black/60' : 'text-white/50')}>
                ×{event.giftCount}
              </span>
            )}
            {event.giftDiamonds != null && (
              <span className="text-xs text-[#ffd700]/80">
                💎 {event.giftDiamonds * (event.giftCount ?? 1)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timestamp (chat page only) */}
      {!compact && (
        <span className="ml-auto shrink-0 text-xs text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100">
          {timeStr}
        </span>
      )}
    </div>
  )
}
