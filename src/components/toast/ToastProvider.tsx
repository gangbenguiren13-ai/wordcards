import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ToastContext, type ToastItem, type ToastKind } from './ToastContext'

/** 全ミューテーションの失敗を受け止める共通経路。個別の操作直下にも ActionError を置く。 */
export function ToastProvider({ children, onReady }: {
  children: ReactNode; onReady?: (show: (message: string, kind?: ToastKind) => void) => void
}) {
  const { pathname } = useLocation()
  const student = pathname.startsWith('/p/')
  const [items, setItems] = useState<ToastItem[]>([])
  const [saved, setSaved] = useState(false)
  const [gameRole, setGameRole] = useState<'teacher' | 'student' | null>(null)
  const nextId = useRef(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const audience = useRef({ student, gameRole })
  useEffect(() => { audience.current = { student, gameRole } }, [student, gameRole])
  useEffect(() => {
    if (gameRole !== 'teacher') return
    // 設定画面の失敗が残ったまま開始しても、ゲームでは3秒で片付ける。
    const existingBefore = nextId.current
    const timer = setTimeout(() => setItems(prev => prev.filter(item => item.id >= existingBefore)), 3000)
    return () => clearTimeout(timer)
  }, [gameRole])
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); timers.current.forEach(clearTimeout) }, [])
  const show = useCallback((message: string, kind: ToastKind = 'error') => {
    // 先生がログイン済みでも、生徒ルートに教師向け通知を表示しない。
    if (audience.current.student || audience.current.gameRole === 'student') return
    if (kind === 'success') {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaved(true)
      saveTimer.current = setTimeout(() => setSaved(false), 1500)
      return
    }
    const id = nextId.current++
    setItems(prev => [...prev.filter(t => t.message !== message), { id, kind, message }])
    if (kind !== 'error' || audience.current.gameRole === 'teacher') {
      const timer = setTimeout(() => { setItems(prev => prev.filter(t => t.id !== id)); timers.current.delete(timer) }, 3000)
      timers.current.add(timer)
    }
  }, [])
  const api = useMemo(() => ({ show, saved, setGameRole }), [show, saved])
  useEffect(() => { onReady?.(show) }, [onReady, show])
  return <ToastContext.Provider value={api}>
    {children}
    {!student && gameRole !== 'student' && <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 p-4 pb-safe" aria-live="polite">
      {items.map(t => <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border-2 p-3 font-bold shadow-lg ${t.kind === 'error' ? 'border-danger-500 bg-danger-50 text-danger-700' : 'border-brand-500 bg-brand-50 text-brand-700'}`}>
        <p className="flex-1">{t.kind === 'error' ? '⚠' : 'ℹ'} {t.message}</p>
        <button className="min-h-11 min-w-11 rounded-xl border-2 px-2" aria-label="通知を閉じる" onClick={() => setItems(prev => prev.filter(i => i.id !== t.id))}>閉じる</button>
      </div>)}
    </div>}
  </ToastContext.Provider>
}
