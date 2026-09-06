import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastItem, type ToastKind } from './ToastContext'

const STYLES: Record<ToastKind, string> = {
  error: 'border-danger-500 bg-danger-50 text-danger-700',
  success: 'border-ok-500 bg-ok-50 text-ok-700',
  info: 'border-brand-500 bg-brand-50 text-brand-700',
}
const ICONS: Record<ToastKind, string> = { error: '⚠', success: '✓', info: 'ℹ' }

/**
 * 画面の下に短く出る通知。
 *
 * 「押しても何も起こらない」が一番デバッグしづらい状態なので、
 * サーバー操作の失敗は個別に書くのではなく、必ずここを通して表示する。
 * 成功の合図（保存しました）も同じ経路にして、教師が状態を見失わないようにする。
 */
export function ToastProvider({
  children,
  onReady,
}: {
  children: ReactNode
  /** 画面の外（TanStack Query の共通エラー処理）から呼べるように show を渡す */
  onReady?: (show: (message: string, kind?: ToastKind) => void) => void
}) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, kind: ToastKind = 'error') => {
    const id = nextId.current++
    setItems((prev) => [...prev.slice(-2), { id, kind, message }])
    const ms = kind === 'error' ? 6000 : 2500
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ms)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  useEffect(() => {
    onReady?.(show)
  }, [onReady, show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-safe"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto w-full max-w-md rounded-xl border-2 px-4 py-3',
              'text-center text-sm font-bold shadow-lg',
              STYLES[t.kind],
            ].join(' ')}
          >
            <span aria-hidden="true">{ICONS[t.kind]}</span> {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
