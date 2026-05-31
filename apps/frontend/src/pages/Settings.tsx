import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getTokens, createToken, deleteToken } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { TikTokIcon } from '@/components/PlatformBadge'
import {
  Settings2,
  Twitch,
  Youtube,
  Key,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Monitor,
  MessageSquare,
  ShieldCheck,
  LogOut,
} from 'lucide-react'

interface Token {
  token: string
  label: string
  created_at: number
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [tokens, setTokens] = useState<Token[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [creatingToken, setCreatingToken] = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), getTokens()])
      .then(([s, t]) => {
        setSettings(s)
        setTokens(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (keys: string[]) => {
    setSaving(true)
    try {
      const partial = Object.fromEntries(keys.map((k) => [k, settings[k] ?? '']))
      await updateSettings(partial)
      toast({ title: 'Settings saved', description: 'Changes applied successfully.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateToken = async () => {
    if (!newTokenLabel.trim()) return
    setCreatingToken(true)
    try {
      const token = await createToken(newTokenLabel.trim())
      setTokens((prev) => [token, ...prev])
      setNewTokenLabel('')
      toast({ title: 'Token created', description: `"${token.label}" has been created.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to create token.', variant: 'destructive' })
    } finally {
      setCreatingToken(false)
    }
  }

  const handleDeleteToken = async (token: string) => {
    try {
      await deleteToken(token)
      setTokens((prev) => prev.filter((t) => t.token !== token))
      toast({ title: 'Token deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete token.', variant: 'destructive' })
    }
  }

  const copyOverlayUrl = (token: string) => {
    const expire = s('overlay_expire_seconds') || '30'
    const max = s('overlay_max_messages') || '20'
    const fontSize = s('overlay_font_size') || '16'
    const anim = s('overlay_animation_speed') || 'normal'
    const theme = s('overlay_theme') || 'dark'
    
    const url = `${window.location.origin}/overlay?token=${token}&expire=${expire}&max=${max}&fontSize=${fontSize}&anim=${anim}&theme=${theme}`
    navigator.clipboard.writeText(url).catch(console.error)
    toast({ title: 'Copied', description: 'Overlay URL copied to clipboard.' })
  }

  const s = (key: string) => settings[key] ?? ''
  const set = (key: string, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
        <RefreshCw className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Toaster />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.95)] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.6)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h1 className="text-base font-semibold">Settings</h1>
          </div>
          <a
            href="/auth/logout"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Tabs defaultValue="channels">
          <TabsList className="mb-8 flex w-fit flex-wrap gap-0.5">
            <TabsTrigger value="channels" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="overlay" className="gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              Overlay
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Auth
            </TabsTrigger>
          </TabsList>

          {/* ── Channels ── */}
          <TabsContent value="channels" className="space-y-8">

            {/* Twitch */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Twitch className="h-4 w-4 text-[#9146FF]" />
                <h2 className="text-sm font-semibold">Twitch</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitch-channel">Channel name</Label>
                <Input
                  id="twitch-channel"
                  placeholder="yourchannelname"
                  value={s('twitch_channel')}
                  onChange={(e) => set('twitch_channel', e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No # prefix needed. Leave empty to disable.
                </p>
              </div>
              <Button
                onClick={() => handleSave(['twitch_channel'])}
                disabled={saving}
                size="sm"
              >
                {saving && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
                Save
              </Button>
            </section>

            <Separator />

            {/* YouTube */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-[#FF0000]" />
                <h2 className="text-sm font-semibold">YouTube</h2>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="yt-channel-id">Channel ID</Label>
                  <Input
                    id="yt-channel-id"
                    placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                    value={s('youtube_channel_id')}
                    onChange={(e) => set('youtube_channel_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yt-api-key">API Key</Label>
                  <Input
                    id="yt-api-key"
                    type="password"
                    placeholder="AIzaSy..."
                    value={s('youtube_api_key')}
                    onChange={(e) => set('youtube_api_key', e.target.value)}
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Requires YouTube Data API v3 access.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleSave(['youtube_channel_id', 'youtube_api_key'])}
                disabled={saving}
                size="sm"
              >
                {saving && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
                Save
              </Button>
            </section>

            <Separator />

            {/* TikTok */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <TikTokIcon className="h-4 w-4 text-[#00f2ea]" />
                <h2 className="text-sm font-semibold">TikTok</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktok-username">Username</Label>
                <Input
                  id="tiktok-username"
                  placeholder="@yourusername"
                  value={s('tiktok_username')}
                  onChange={(e) => set('tiktok_username', e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  @ prefix is optional. Leave empty to disable.
                </p>
              </div>
              <Button
                onClick={() => handleSave(['tiktok_username'])}
                disabled={saving}
                size="sm"
              >
                {saving && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
                Save
              </Button>
            </section>
          </TabsContent>

          {/* ── Overlay ── */}
          <TabsContent value="overlay" className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-semibold">OBS Overlay Configuration</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                These are default values. You can also override them per-token via URL params
                (<code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">?expire=30&amp;max=20&amp;fontSize=16&amp;anim=normal&amp;theme=dark</code>).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="overlay-theme">Theme</Label>
                <select
                  id="overlay-theme"
                  className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--input))] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  value={s('overlay_theme') || 'dark'}
                  onChange={(e) => set('overlay_theme', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expire-seconds">Message expiry (seconds)</Label>
                <Input
                  id="expire-seconds"
                  type="number"
                  min="5"
                  max="300"
                  value={s('overlay_expire_seconds')}
                  onChange={(e) => set('overlay_expire_seconds', e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-messages">Max messages shown</Label>
                <Input
                  id="max-messages"
                  type="number"
                  min="1"
                  max="50"
                  value={s('overlay_max_messages')}
                  onChange={(e) => set('overlay_max_messages', e.target.value)}
                  placeholder="20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-size">Font size (px)</Label>
                <Input
                  id="font-size"
                  type="number"
                  min="10"
                  max="32"
                  value={s('overlay_font_size')}
                  onChange={(e) => set('overlay_font_size', e.target.value)}
                  placeholder="16"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anim-speed">Animation speed</Label>
                <select
                  id="anim-speed"
                  className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--input))] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  value={s('overlay_animation_speed') || 'normal'}
                  onChange={(e) => set('overlay_animation_speed', e.target.value)}
                >
                  <option value="slow">Slow (0.5s)</option>
                  <option value="normal">Normal (0.3s)</option>
                  <option value="fast">Fast (0.15s)</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() =>
                handleSave([
                  'overlay_expire_seconds',
                  'overlay_max_messages',
                  'overlay_font_size',
                  'overlay_animation_speed',
                  'overlay_theme',
                ])
              }
              disabled={saving}
              size="sm"
            >
              {saving && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
              Save Overlay Settings
            </Button>
          </TabsContent>

          {/* ── Tokens ── */}
          <TabsContent value="tokens" className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-semibold">Overlay Tokens</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Tokens authenticate the OBS browser source overlay. Each token is embedded in the overlay URL.
              </p>
            </div>

            {/* Create new token */}
            <div className="flex gap-2">
              <Input
                placeholder="Token label — e.g. OBS Main Scene"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateToken()}
              />
              <Button
                onClick={handleCreateToken}
                disabled={creatingToken || !newTokenLabel.trim()}
              >
                {creatingToken ? (
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Create
              </Button>
            </div>

            {/* Token list */}
            <div className="space-y-2">
              {tokens.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-10 text-center">
                  <Key className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--muted-foreground)/0.3)]" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    No tokens yet. Create one above.
                  </p>
                </div>
              ) : (
                tokens.map((t) => (
                  <div
                    key={t.token}
                    className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">{t.label}</p>
                      <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        {t.token.slice(0, 16)}…
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)]">
                        Created {new Date(t.created_at * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyOverlayUrl(t.token)}
                        title="Copy overlay URL"
                        aria-label={`Copy overlay URL for ${t.label}`}
                      >
                        <Copy className="h-4 w-4" />
                        <span className="ml-1 hidden text-xs sm:inline">Copy URL</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteToken(t.token)}
                        title="Delete token"
                        aria-label={`Delete token ${t.label}`}
                        className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Auth ── */}
          <TabsContent value="auth" className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-semibold">OIDC Authentication</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Configure your OpenID Connect provider. Changes require a server restart.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oidc-issuer">Issuer URL</Label>
                <Input
                  id="oidc-issuer"
                  placeholder="https://your-oidc-provider.example.com"
                  value={s('oidc_issuer')}
                  onChange={(e) => set('oidc_issuer', e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Must expose <code className="rounded bg-[hsl(var(--muted))] px-1">/.well-known/openid-configuration</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidc-client-id">Client ID</Label>
                <Input
                  id="oidc-client-id"
                  placeholder="stool"
                  value={s('oidc_client_id')}
                  onChange={(e) => set('oidc_client_id', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidc-client-secret">Client Secret</Label>
                <Input
                  id="oidc-client-secret"
                  type="password"
                  placeholder="your-client-secret"
                  value={s('oidc_client_secret')}
                  onChange={(e) => set('oidc_client_secret', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidc-redirect-uri">Redirect URI</Label>
                <Input
                  id="oidc-redirect-uri"
                  placeholder="http://localhost:4000/auth/callback"
                  value={s('oidc_redirect_uri')}
                  onChange={(e) => set('oidc_redirect_uri', e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  This must match exactly what is registered with your OIDC provider.
                </p>
              </div>

              <Button
                onClick={() =>
                  handleSave(['oidc_issuer', 'oidc_client_id', 'oidc_client_secret', 'oidc_redirect_uri'])
                }
                disabled={saving}
                size="sm"
              >
                {saving && <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />}
                Save Auth Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
