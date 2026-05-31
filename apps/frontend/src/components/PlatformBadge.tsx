import { cn } from '@/lib/utils'
import { Twitch, Youtube } from 'lucide-react'

// TikTok icon — not in Lucide, use custom SVG
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  )
}

const PLATFORM_CONFIG = {
  twitch: {
    label: 'Twitch',
    color: 'bg-[#9146FF]/20 text-[#9146FF] border-[#9146FF]/30',
    icon: Twitch,
  },
  youtube: {
    label: 'YouTube',
    color: 'bg-[#FF0000]/20 text-[#FF0000] border-[#FF0000]/30',
    icon: Youtube,
  },
  tiktok: {
    label: 'TikTok',
    color: 'bg-[#00f2ea]/20 text-[#00f2ea] border-[#00f2ea]/30',
    icon: TikTokIcon,
  },
} as const

interface PlatformBadgeProps {
  platform: 'twitch' | 'youtube' | 'tiktok'
  className?: string
  size?: 'sm' | 'md'
}

export function PlatformBadge({ platform, className, size = 'sm' }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform]
  const Icon = config.icon
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      <Icon className={iconSize} />
      {config.label}
    </span>
  )
}

// Export TikTokIcon for use in other components (e.g. Settings)
export { TikTokIcon }
