import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // The backend handles the OIDC callback at /auth/callback and sets a session cookie.
    // After the backend redirects back to the frontend at /auth/callback,
    // we just redirect the user to their destination.
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('returnTo') ?? '/chat'

    // Small delay to allow session cookie to be set
    const timeout = setTimeout(() => {
      navigate(returnTo, { replace: true })
    }, 500)

    return () => clearTimeout(timeout)
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <ShieldCheck className="h-12 w-12 text-[hsl(var(--primary))]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            Signing you in...
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Completing authentication
          </div>
        </div>
      </div>
    </div>
  )
}
