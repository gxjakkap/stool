import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getCommands,
  createCommand,
  updateCommand,
  removeCommand,
  testCommand,
  getTimers,
  createTimer,
  updateTimer,
  removeTimer,
  getSettings,
  updateSettings,
  type BotCommand,
  type BotTimer,
  type BotPlatform,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { Bot, Clock, ExternalLink, FlaskConical, Pencil, Pin, Plus, RefreshCw, Save, Settings, Trash2, X } from 'lucide-react'

const textareaClass =
  'flex min-h-20 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--input))] px-3 py-2 font-mono text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]'

const fail = (e: unknown) => {
  toast({ title: 'Error', description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
}

const emptyCommand: BotCommand = { trigger: '', response: '', prefixUser: true }
const emptyTimer: Omit<BotTimer, 'id'> = { message: '', intervalMinutes: 10, minLines: 0, platforms: ['twitch', 'kick'], enabled: true }

export default function Commands() {
  const [commands, setCommands] = useState<BotCommand[]>([])
  const [timers, setTimers] = useState<BotTimer[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () =>
    Promise.all([getCommands(), getTimers()])
      .then(([c, t]) => {
        setCommands(c)
        setTimers(t)
      })
      .catch(fail)

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

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
      <header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h1 className="text-base font-semibold">Bot</h1>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild title="Public command list" aria-label="Public command list">
              <a href="/commands" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild title="Settings" aria-label="Settings">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Tabs defaultValue="commands">
          <TabsList className="mb-8 flex w-fit gap-0.5">
            <TabsTrigger value="commands" className="gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Commands
            </TabsTrigger>
            <TabsTrigger value="timers" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Timers
            </TabsTrigger>
            <TabsTrigger value="pinned" className="gap-1.5">
              <Pin className="h-3.5 w-3.5" />
              Pinned
            </TabsTrigger>
          </TabsList>
          <TabsContent value="commands">
            <CommandsTab commands={commands} reload={reload} />
          </TabsContent>
          <TabsContent value="timers">
            <TimersTab timers={timers} reload={reload} />
          </TabsContent>
          <TabsContent value="pinned">
            <PinnedTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function CommandsTab({ commands, reload }: { commands: BotCommand[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState<BotCommand>(emptyCommand)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testArgs, setTestArgs] = useState('')
  const [testResult, setTestResult] = useState<{ output?: string; error?: string } | null>(null)

  const reset = () => {
    setForm(emptyCommand)
    setEditing(false)
    setTestResult(null)
  }

  const save = async () => {
    setSaving(true)
    try {
      await (editing ? updateCommand(form) : createCommand(form))
      toast({ title: editing ? 'Command updated' : 'Command added', description: form.trigger })
      reset()
      await reload()
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    try {
      setTestResult(await testCommand(form.response, 'tester', testArgs.split(/\s+/).filter(Boolean)))
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (trigger: string) => {
    if (!window.confirm(`Delete ${trigger}?`)) return
    try {
      await removeCommand(trigger)
      if (form.trigger === trigger) reset()
      await reload()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h2 className="text-sm font-semibold">{editing ? `Edit ${form.trigger}` : 'Add command'}</h2>
        <div className="space-y-1">
          <Label htmlFor="cmd-trigger">Trigger</Label>
          <Input
            id="cmd-trigger"
            placeholder="!discord"
            value={form.trigger}
            disabled={editing}
            onChange={(e) => setForm({ ...form, trigger: e.target.value.trim() })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cmd-response">Response</Label>
          <textarea
            id="cmd-response"
            className={textareaClass}
            placeholder={'https://discord.gg/...   or   ${user} hugs ${args[0] ?? "everyone"}'}
            value={form.response}
            onChange={(e) => setForm({ ...form, response: e.target.value })}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <code>{'${ expr }'}</code> runs JavaScript in a sandbox. Available: <code>user</code>, <code>args</code>,{' '}
            <code>query</code>, <code>platform</code>, <code>fetch</code>. Write <code>{'\\${'}</code> for a literal{' '}
            <code>{'${'}</code>.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.prefixUser}
            onChange={(e) => setForm({ ...form, prefixUser: e.target.checked })}
          />
          Prefix reply with @user
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving || !form.trigger || !form.response}>
            {saving ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Plus className="mr-1.5 h-3 w-3" />}
            {editing ? 'Save' : 'Add'}
          </Button>
          {editing && (
            <Button size="sm" variant="ghost" onClick={reset}>
              <X className="mr-1.5 h-3 w-3" />
              Cancel
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Input
              className="h-8 w-40"
              placeholder="test args"
              aria-label="Test arguments"
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
            />
            <Button size="sm" variant="ghost" onClick={test} disabled={!form.response}>
              <FlaskConical className="mr-1.5 h-3 w-3" />
              Test
            </Button>
          </div>
        </div>
        {testResult && (
          <pre
            className={`whitespace-pre-wrap rounded-md p-3 text-xs ${testResult.error ? 'bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--muted))]'}`}
          >
            {testResult.error ?? testResult.output}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        {commands.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No commands yet.
          </p>
        ) : (
          commands.map((c) => (
            <div
              key={c.trigger}
              className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {c.trigger}
                  {!c.prefixUser && <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">no prefix</span>}
                </p>
                <p className="break-words font-mono text-xs text-[hsl(var(--muted-foreground))]">{c.response}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${c.trigger}`}
                  onClick={() => {
                    setForm(c)
                    setEditing(true)
                    setTestResult(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${c.trigger}`}
                  onClick={() => remove(c.trigger)}
                  className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

const PLATFORMS: { id: BotPlatform; label: string }[] = [
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' },
]

function TimersTab({ timers, reload }: { timers: BotTimer[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState<Omit<BotTimer, 'id'> & { id?: number }>(emptyTimer)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      if (form.id !== undefined) await updateTimer(form as BotTimer)
      else await createTimer(form)
      toast({ title: form.id !== undefined ? 'Timer updated' : 'Timer added' })
      setForm(emptyTimer)
      await reload()
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (t: BotTimer) => {
    try {
      await updateTimer({ ...t, enabled: !t.enabled })
      await reload()
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this timer?')) return
    try {
      await removeTimer(id)
      if (form.id === id) setForm(emptyTimer)
      await reload()
    } catch (e) {
      fail(e)
    }
  }

  const togglePlatform = (p: BotPlatform, on: boolean) =>
    setForm({ ...form, platforms: on ? [...form.platforms, p] : form.platforms.filter((x) => x !== p) })

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h2 className="text-sm font-semibold">{form.id !== undefined ? 'Edit timer' : 'Add timer'}</h2>
        <div className="space-y-1">
          <Label htmlFor="timer-message">Message</Label>
          <textarea
            id="timer-message"
            className={textareaClass}
            placeholder="Follow the channel! Macros with ${ } work here too."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="timer-interval">Interval (minutes)</Label>
            <Input
              id="timer-interval"
              type="number"
              min={1}
              value={form.intervalMinutes}
              onChange={(e) => setForm({ ...form, intervalMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timer-lines">Min chat lines since last post</Label>
            <Input
              id="timer-lines"
              type="number"
              min={0}
              value={form.minLines}
              onChange={(e) => setForm({ ...form, minLines: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.platforms.includes(p.id)}
                onChange={(e) => togglePlatform(p.id, e.target.checked)}
              />
              {p.label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Timers only post while the stream is live, counted separately per platform.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !form.message || !form.platforms.length || form.intervalMinutes < 1}
          >
            {saving ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Plus className="mr-1.5 h-3 w-3" />}
            {form.id !== undefined ? 'Save' : 'Add'}
          </Button>
          {form.id !== undefined && (
            <Button size="sm" variant="ghost" onClick={() => setForm(emptyTimer)}>
              <X className="mr-1.5 h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        {timers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No timers yet.
          </p>
        ) : (
          timers.map((t) => (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 ${t.enabled ? '' : 'opacity-50'}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words font-mono text-xs">{t.message}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Every {t.intervalMinutes} min, at least {t.minLines} lines, on {t.platforms.join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label className="mr-1 flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={t.enabled} onChange={() => toggle(t)} aria-label="Enabled" />
                  On
                </label>
                <Button variant="ghost" size="sm" aria-label="Edit timer" onClick={() => setForm(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete timer"
                  onClick={() => remove(t.id)}
                  className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function PinnedTab() {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => setMessage(s.pinned_message ?? ''))
      .catch(fail)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await updateSettings({ pinned_message: message })
      toast({ title: 'Pinned message saved' })
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 className="text-sm font-semibold">Stream start message</h2>
      <div className="space-y-1">
        <Label htmlFor="pinned-message">Message</Label>
        <textarea
          id="pinned-message"
          className={textareaClass}
          placeholder="Donate >> https://... Subscribe >> https://... Macros with ${ } work here too."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Posted by the bot once per stream on each platform that goes live. On Twitch it is pinned until the stream ends
        (the bot must be a moderator). Kick has no pin API, so there it is only sent. Leave empty to disable.
      </p>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
        Save
      </Button>
    </section>
  )
}
