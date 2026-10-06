import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { botConnectUrl, disconnectBotAccount, getBotStatus, type BotPlatform, type BotRole } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { KickIcon } from '@/components/PlatformBadge'
import { ExternalLink, Twitch } from 'lucide-react'

type Status = Awaited<ReturnType<typeof getBotStatus>>

const PLATFORMS: { id: BotPlatform; label: string; icon: React.ReactNode }[] = [
  { id: 'twitch', label: 'Twitch', icon: <Twitch className="h-4 w-4 text-[#9146FF]" /> },
  { id: 'kick', label: 'Kick', icon: <KickIcon className="h-4 w-4 text-[#53FC18]" /> },
]

const ROLES: { id: BotRole; label: string; hint: string }[] = [
  { id: 'bot', label: 'Bot account', hint: 'Reads and replies in chat.' },
  { id: 'broadcaster', label: 'Broadcaster account', hint: 'Lets mods change the title and game with !title and !game.' },
]

export function BotAccounts() {
  const [status, setStatus] = useState<Status | null>(null)

  const reload = () => getBotStatus().then(setStatus).catch(console.error)

  useEffect(() => {
    reload()
    // Result of the OAuth round trip, passed back by the backend redirect
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('bot_connected')
    const error = params.get('bot_error')
    if (connected) toast({ title: 'Account connected', description: connected.replace('_', ' ') })
    if (error) toast({ title: 'Connect failed', description: error, variant: 'destructive' })
    if (connected || error) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const disconnect = async (platform: BotPlatform, role: BotRole) => {
    try {
      await disconnectBotAccount(platform, role)
      await reload()
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-sm font-semibold">Bot accounts</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Log in with the account the bot should use. Set the platform's Client ID and Secret on the Channels tab first, and
            add the redirect URI below to your app in the platform's developer console.
          </p>
        </div>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/settings/commands">
            Commands
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {PLATFORMS.map((p, i) => (
        <section key={p.id} className="space-y-4">
          {i > 0 && <Separator className="mb-8" />}
          <div className="flex items-center gap-2">
            {p.icon}
            <h3 className="text-sm font-semibold">{p.label}</h3>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Redirect URI: <code className="break-all">{status?.redirectUris[p.id] ?? '...'}</code>
          </p>
          {ROLES.map((r) => {
            const login = status?.accounts[p.id][r.id]
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {login ? `Connected as ${login}` : 'Not connected'}. {r.hint}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant={login ? 'ghost' : 'default'} asChild>
                    <a href={botConnectUrl(p.id, r.id)}>{login ? 'Reconnect' : 'Connect'}</a>
                  </Button>
                  {login && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disconnect(p.id, r.id)}
                      className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
