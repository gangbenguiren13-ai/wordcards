import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { Spinner } from '@/components/ui'

/** /t/* をログイン必須にするガード */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="確認しています…" />
  if (!user) return <Navigate to="/t/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
