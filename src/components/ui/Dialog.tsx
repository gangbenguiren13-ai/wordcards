import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 破壊的操作の前に必ず出す確認ダイアログ（計画書 14） */
export function Dialog({
  open,
  title,
  children,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
      >
        <h2 className="text-xl font-bold">{title}</h2>
        {children && <div className="mt-3 text-ink-soft">{children}</div>}
        <div className="mt-6 flex gap-3">
          <Button block onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            block
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '処理中…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
