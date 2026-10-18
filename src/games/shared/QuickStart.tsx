import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import { GameIcon } from '@/components/GameIcon'

const key = (game: string, field: string) => `wordcards.setup.${game}.${field}`
export function hasStarted(game: string): boolean {
  try { return localStorage.getItem(key(game, 'started')) === 'true' } catch { return false }
}
export function rememberStarted(game: string) {
  try { localStorage.setItem(key(game, 'started'), 'true') } catch { /* private browsing */ }
}

/** 教師画面だけの設定開閉。生徒側の公開設定とは独立させる。 */
export function QuickStart({ game, count, summary, disabled, busy, onStart, children, feedback, controls }: {
  game: string; count: number; summary: string; disabled?: boolean; busy?: boolean
  onStart: () => void; children: ReactNode; feedback?: ReactNode; controls?: ReactNode
}) {
  const id = useId()
  const [previous] = useState(() => hasStarted(game))
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key(game, 'expanded'))
      if (saved !== null) return saved === 'true'
    } catch { /* use initial state */ }
    return !previous
  })
  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(key(game, 'expanded'), String(next)) } catch { /* noop */ }
  }
  return <>
    <section aria-label="ゲームをはじめる" className="teacher-quick-start">
      <Button variant="play" icon={<GameIcon name="play" filled />} size="xl" block disabled={disabled || busy} onClick={onStart}>
        {busy ? 'よみこみちゅう…' : <span className="quick-start-label">
          {previous && <span>前回と同じ設定で</span>}<span>はじめる（{count}枚）</span>
        </span>}
      </Button>
      {feedback}
      <p className="text-center text-base text-ink-soft" aria-label="設定の要約">{summary}</p>
    </section>
    {controls && <div className="teacher-screen-mode">{controls}</div>}
    <Button variant="paper" aria-expanded={open} aria-controls={id} disabled={busy} onClick={toggle}>
      {open ? '▾ 設定を閉じる' : '▸ 設定を変える'}
    </Button>
    <div id={id} hidden={!open}>{children}</div>
  </>
}
