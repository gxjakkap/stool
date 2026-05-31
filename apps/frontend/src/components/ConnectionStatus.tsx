import { cn } from '@/lib/utils'
import { Wifi, WifiOff } from 'lucide-react'

interface ConnectionStatusProps {
  connected: boolean
  className?: string
}

export function ConnectionStatus({ connected, className }: ConnectionStatusProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        connected
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]',
        className
      )}
      role="status"
      aria-label={connected ? 'WebSocket connected' : 'WebSocket disconnected'}
    >
      {connected ? (
        <>
          <Wifi className="h-3 w-3" />
          Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Disconnected
        </>
      )}
    </div>
  )
}
