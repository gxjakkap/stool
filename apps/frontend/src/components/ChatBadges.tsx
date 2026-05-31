import { Video, Sword, Diamond, Star, Crown, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatBadgesProps {
  badges?: string[]
  className?: string
  size?: 'sm' | 'default'
}

export function ChatBadges({ badges, className, size = 'default' }: ChatBadgesProps) {
  if (!badges || badges.length === 0) return null

  const iconClass = cn(
    'shrink-0',
    size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
    className
  )

  return (
    <div className="flex items-center gap-1">
      {badges.map((b) => {
        switch (b) {
          case 'broadcaster':
            return <Video key={b} className={cn(iconClass, 'text-[#E9113C] fill-[#E9113C]/20')} aria-label="Broadcaster" />
          case 'moderator':
            return <Sword key={b} className={cn(iconClass, 'text-[#00AD03] fill-[#00AD03]/20')} aria-label="Moderator" />
          case 'vip':
            return <Diamond key={b} className={cn(iconClass, 'text-[#E005B9] fill-[#E005B9]/20')} aria-label="VIP" />
          case 'subscriber':
          case 'founder':
            return <Star key={b} className={cn(iconClass, 'text-[#8205B4] fill-[#8205B4]/20')} aria-label="Subscriber" />
          case 'staff':
          case 'admin':
          case 'global_mod':
            return <ShieldCheck key={b} className={cn(iconClass, 'text-[#6441A4] fill-[#6441A4]/20')} aria-label="Staff" />
          case 'premium':
          case 'turbo':
            return <Crown key={b} className={cn(iconClass, 'text-[#00D6D6] fill-[#00D6D6]/20')} aria-label="Premium" />
          default:
            return null
        }
      })}
    </div>
  )
}
