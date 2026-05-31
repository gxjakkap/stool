import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getMe } from '@/lib/api'

const Overlay = lazy(() => import('./pages/Overlay'))
const Chat = lazy(() => import('./pages/Chat'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const navigate = useNavigate()

  useEffect(() => {
    getMe()
      .then(() => setStatus('authenticated'))
      .catch(() => {
        setStatus('unauthenticated')
        navigate('/login', { replace: true })
      })
  }, [navigate])

  if (status === 'loading') return <Spinner />
  if (status === 'unauthenticated') return null
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public routes */}
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route
            path="/chat"
            element={
              <AuthGuard>
                <Chat />
              </AuthGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthGuard>
                <Settings />
              </AuthGuard>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
