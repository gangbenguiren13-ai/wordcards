import { useToast } from '@/components/toast/useToast'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui'
import '@/styles/teacherGlass.css'

/** 教師用画面の共通ヘッダー。生徒用画面では使わない。 */
export function AppHeader({ title, back, dark = false }: { title?: string; back?: string; dark?: boolean }) {
  const { user, signOut } = useAuth()
  const toast = useToast()
  return (
    <header className={`teacher-app-header sticky top-0 z-30 border-b-2 border-line bg-surface${dark ? ' teacher-header' : ''}`}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 p-3">
        {back ? (
          <Link
            to={back}
            className={`inline-flex min-h-11 items-center gap-1 rounded-xl border-2 border-line px-3 font-bold${dark ? ' game-button game-button--paper' : ''}`}
          >
            ← もどる
          </Link>
        ) : (
          <span className="text-xl font-bold text-brand-700">WordCards</span>
        )}
        {title && <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-ink-soft sm:inline">{user?.email}</span>
          <Button variant={dark ? 'paper' : 'secondary'} onClick={() => void signOut().catch(error => toast.show(String(error)))}>ログアウト</Button>
          <span role="status" aria-live="polite" className="min-w-24 text-right font-bold text-ok-700">{toast.saved ? '✓ 保存済み' : ''}</span>
        </div>
      </div>
    </header>
  )
}
