import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function Login() {
  useEffect(() => {
    window.location.href = '/auth/login'
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Redirecting to login...
        </p>
      </div>
    </div>
  )
}
