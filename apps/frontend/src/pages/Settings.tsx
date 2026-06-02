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
  HeartHandshake,
} from 'lucide-react'

interface Token {
  token: string
  label: string
  created_at: number
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.warn(error)
    }
  }

  return [storedValue, setValue] as const
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [tokens, setTokens] = useState<Token[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [creatingToken, setCreatingToken] = useState(false)

  // ── Donation overlay builder state ──
  const [donNameColor,   setDonNameColor]   = useLocalStorage('donNameColor', '#FFD700')
  const [donAmountColor, setDonAmountColor] = useLocalStorage('donAmountColor', '#4ADE80')
  const [donMsgColor,    setDonMsgColor]    = useLocalStorage('donMsgColor', '#FFFFFF')
  const [donTextColor,   setDonTextColor]   = useLocalStorage('donTextColor', '#FFFFFF')
  const [donTemplate,    setDonTemplate]    = useLocalStorage('donTemplate', '{name} donated \u0e3f{amount}!')
  const [donFadeIn,      setDonFadeIn]      = useLocalStorage('donFadeIn', '0.5')
  const [donFadeOut,     setDonFadeOut]     = useLocalStorage('donFadeOut', '0.5')
  const [donHoldTime,    setDonHoldTime]    = useLocalStorage('donHoldTime', '5')
  const [donTts,         setDonTts]         = useLocalStorage('donTts', false)
  const [donTtsVoice,    setDonTtsVoice]    = useLocalStorage('donTtsVoice', 'Zephyr')
  const [donSoundUrl,    setDonSoundUrl]    = useLocalStorage('donSoundUrl', '')
  const [donImageUrl,    setDonImageUrl]    = useLocalStorage('donImageUrl', '')
  const [donToken,       setDonToken]       = useLocalStorage('donToken', '')

  const copyDonationUrl = () => {
    const p = new URLSearchParams()
    if (donToken) p.set('token', donToken)
    p.set('nameColor',   donNameColor)
    p.set('amountColor', donAmountColor)
    p.set('msgColor',    donMsgColor)
    p.set('textColor',   donTextColor)
    p.set('template',    donTemplate)
    p.set('fadeIn',      donFadeIn)
    p.set('fadeOut',     donFadeOut)
    p.set('holdTime',    donHoldTime)
    if (donImageUrl.trim()) p.set('imageUrl', donImageUrl.trim())
    if (donSoundUrl.trim()) p.set('soundUrl', donSoundUrl.trim())
    p.set('tts',         donTts ? '1' : '0')
    p.set('ttsVoice',    donTtsVoice)
    const url = `${window.location.origin}/donation-overlay?${p.toString()}`
    navigator.clipboard.writeText(url).catch(console.error)
    toast({ title: 'Copied', description: 'Donation overlay URL copied to clipboard.' })
  }

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
            <TabsTrigger value="donation" className="gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5" />
              Donation Overlay
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
                  placeholder="Your Twitch channel"
                  value={s('twitch_channel')}
                  onChange={(e) => set('twitch_channel', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="twitch-client-id">Client ID</Label>
                <Input
                  id="twitch-client-id"
                  value={s('twitch_client_id')}
                  onChange={(e) => set('twitch_client_id', e.target.value)}
                  placeholder="Twitch API Client ID"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="twitch-client-secret">Client Secret</Label>
                <Input
                  id="twitch-client-secret"
                  type="password"
                  value={s('twitch_client_secret')}
                  onChange={(e) => set('twitch_client_secret', e.target.value)}
                  placeholder="Twitch API Client Secret"
                />
              </div>
              
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No # prefix needed. Leave empty to disable.
              </p>
              
              <Button
                onClick={() => handleSave(['twitch_channel', 'twitch_client_id', 'twitch_client_secret'])}
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
              <div className="space-y-3">
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
                <div className="space-y-2">
                  <Label htmlFor="tiktok-session-id">Session ID</Label>
                  <Input
                    id="tiktok-session-id"
                    type="password"
                    placeholder="sessionid from tiktok.com cookies"
                    value={s('tiktok_session_id')}
                    onChange={(e) => set('tiktok_session_id', e.target.value)}
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Required to bypass anti-bot websocket blocks. Find this in your browser cookies (named <code>sessionid</code>).
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleSave(['tiktok_username', 'tiktok_session_id'])}
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

          {/* ── Donation Overlay ── */}
          <TabsContent value="donation" className="space-y-8">
            <div>
              <h2 className="mb-1 text-sm font-semibold">Donation Alert Overlay</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Configure the OBS browser-source alert that pops up when a donation arrives via EasyDonate.
              </p>
            </div>

            {/* Token selector */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Auth Token</h3>
              <div className="space-y-2">
                <Label htmlFor="don-token">Overlay token</Label>
                <select
                  id="don-token"
                  className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--input))] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  value={donToken}
                  onChange={(e) => setDonToken(e.target.value)}
                >
                  <option value="">— none (session auth only) —</option>
                  {tokens.map((t) => (
                    <option key={t.token} value={t.token}>{t.label} ({t.token.slice(0, 12)}…)</option>
                  ))}
                </select>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Pick a token so the OBS browser source can authenticate without a session cookie.</p>
              </div>
            </section>

            <Separator />

            {/* Template */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Alert Template</h3>
              <div className="space-y-2">
                <Label htmlFor="don-template">Template text</Label>
                <Input
                  id="don-template"
                  value={donTemplate}
                  onChange={(e) => setDonTemplate(e.target.value)}
                  placeholder="{name} donated ฿{amount}!"
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Placeholders: <code className="rounded bg-[hsl(var(--muted))] px-1">{'{name}'}</code>{' '}
                  <code className="rounded bg-[hsl(var(--muted))] px-1">{'{amount}'}</code>{' '}
                  <code className="rounded bg-[hsl(var(--muted))] px-1">{'{message}'}</code>
                </p>
              </div>
            </section>

            <Separator />

            {/* Colors */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Colors</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="don-name-color">Donator name color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="don-name-color"
                      type="color"
                      value={donNameColor}
                      onChange={(e) => setDonNameColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-[hsl(var(--input))] bg-transparent p-0.5"
                    />
                    <Input value={donNameColor} onChange={(e) => setDonNameColor(e.target.value)} className="font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="don-amount-color">Amount color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="don-amount-color"
                      type="color"
                      value={donAmountColor}
                      onChange={(e) => setDonAmountColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-[hsl(var(--input))] bg-transparent p-0.5"
                    />
                    <Input value={donAmountColor} onChange={(e) => setDonAmountColor(e.target.value)} className="font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="don-msg-color">Message text color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="don-msg-color"
                      type="color"
                      value={donMsgColor}
                      onChange={(e) => setDonMsgColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-[hsl(var(--input))] bg-transparent p-0.5"
                    />
                    <Input value={donMsgColor} onChange={(e) => setDonMsgColor(e.target.value)} className="font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="don-text-color">Default text color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="don-text-color"
                      type="color"
                      value={donTextColor}
                      onChange={(e) => setDonTextColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-[hsl(var(--input))] bg-transparent p-0.5"
                    />
                    <Input value={donTextColor} onChange={(e) => setDonTextColor(e.target.value)} className="font-mono uppercase" />
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Timing */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Timing</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="don-fade-in">Fade-in (seconds)</Label>
                  <Input
                    id="don-fade-in"
                    type="number"
                    min="0"
                    max="3"
                    step="0.1"
                    value={donFadeIn}
                    onChange={(e) => setDonFadeIn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="don-hold">Hold time (seconds)</Label>
                  <Input
                    id="don-hold"
                    type="number"
                    min="1"
                    max="30"
                    step="0.5"
                    value={donHoldTime}
                    onChange={(e) => setDonHoldTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="don-fade-out">Fade-out (seconds)</Label>
                  <Input
                    id="don-fade-out"
                    type="number"
                    min="0"
                    max="3"
                    step="0.1"
                    value={donFadeOut}
                    onChange={(e) => setDonFadeOut(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Media Settings */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Media & Audio</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="don-image-url">Custom Image / GIF URL</Label>
                  <Input
                    id="don-image-url"
                    value={donImageUrl}
                    onChange={(e) => setDonImageUrl(e.target.value)}
                    placeholder="https://example.com/alert.gif"
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Replaces the default 💰 emoji. Use a transparent GIF or WebP for best results. Leave blank for default.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="don-sound-url">Custom Alert Sound URL</Label>
                  <Input
                    id="don-sound-url"
                    value={donSoundUrl}
                    onChange={(e) => setDonSoundUrl(e.target.value)}
                    placeholder="https://example.com/alert.mp3"
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Direct link to an audio file (MP3/WAV). Plays before the TTS reads the message. Leave blank for none.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="don-tts"
                    type="checkbox"
                    checked={donTts}
                    onChange={(e) => setDonTts(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-[hsl(var(--input))] accent-[hsl(var(--primary))]"
                  />
                  <Label htmlFor="don-tts" className="cursor-pointer">Enable Text-to-Speech (Google Translate)</Label>
                </div>
                
                {donTts && (
                  <div className="space-y-2">
                    <Label htmlFor="don-tts-voice">TTS Language</Label>
                    <select
                      id="don-tts-voice"
                      className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--input))] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                      value={donTtsVoice}
                      onChange={(e) => setDonTtsVoice(e.target.value)}
                    >
                      <option value="th">Thai (th)</option>
                      <option value="en">English (en)</option>
                      <option value="ja">Japanese (ja)</option>
                      <option value="ko">Korean (ko)</option>
                      <option value="zh-CN">Chinese (zh-CN)</option>
                    </select>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Free unlimited TTS. No API key required.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Generate URL */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">OBS Browser Source URL</h3>
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3">
                <p className="break-all font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {`${window.location.origin}/donation-overlay?token=${donToken || '<token>'}&nameColor=${encodeURIComponent(donNameColor)}&amountColor=${encodeURIComponent(donAmountColor)}&msgColor=${encodeURIComponent(donMsgColor)}&template=${encodeURIComponent(donTemplate)}&fadeIn=${donFadeIn}&fadeOut=${donFadeOut}&holdTime=${donHoldTime}${donImageUrl ? `&imageUrl=${encodeURIComponent(donImageUrl)}` : ''}${donSoundUrl ? `&soundUrl=${encodeURIComponent(donSoundUrl)}` : ''}&tts=${donTts ? '1' : '0'}&ttsVoice=${donTtsVoice}`}
                </p>
              </div>
              <Button onClick={copyDonationUrl} size="sm" className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy URL
              </Button>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
