import { useEffect, useState } from 'react'
import { getPublicCommands } from '@/lib/api'

export default function PublicCommands() {
  const [commands, setCommands] = useState<Awaited<ReturnType<typeof getPublicCommands>> | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getPublicCommands().then(setCommands).catch(() => setError(true))
  }, [])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-lg font-semibold">Commands</h1>
        {error && <p className="text-sm text-[hsl(var(--destructive))]">Failed to load commands.</p>}
        {commands?.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No commands yet.</p>}
        {!!commands?.length && (
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="w-1/3 py-2 pr-4 font-medium">Command</th>
                <th className="py-2 font-medium">Response</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((c) => (
                <tr key={c.trigger} className="border-b border-[hsl(var(--border)/0.5)] align-top">
                  <td className="break-words py-2 pr-4 font-medium">{c.trigger}</td>
                  <td className="break-words py-2 text-[hsl(var(--muted-foreground))]">
                    {c.response ?? <em>dynamic</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
