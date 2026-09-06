import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui'

/**
 * ゲーム画面の外枠。
 *
 * 授業中に触るものなので、戻る・音声・進捗の位置はゲームが変わっても固定する。
 * 教室の後ろからも見えるよう、本体の領域はできるだけ広く取る。
 */
export function GameShell({
  title,
  progress,
  showProgress,
  audioEnabled,
  audioOn,
  onToggleAudio,
  onExit,
  children,
  footer,
}: {
  title: string
  progress?: { current: number; total: number }
  showProgress?: boolean
  audioEnabled?: boolean
  audioOn?: boolean
  onToggleAudio?: () => void
  onExit: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  // ゲームの途中で誤ってタブを閉じたりリロードしたりすると、
  // ★を付けた記録が消えてやり直しになる。念のため確認を挟む。
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return (
    <div className="no-select flex min-h-dvh flex-col bg-canvas">
      <header className="flex shrink-0 items-center gap-2 border-b-2 border-line bg-surface p-2 pt-safe">
        <Button onClick={onExit} aria-label="ゲームをやめる">
          ← やめる
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {showProgress && progress && (
            <span className="rounded-lg bg-canvas px-3 py-1.5 text-base font-bold tabular-nums">
              {progress.current}／{progress.total}
            </span>
          )}
          {audioEnabled && onToggleAudio && (
            <Button
              onClick={onToggleAudio}
              aria-label={audioOn ? '音を消す' : '音を出す'}
              aria-pressed={audioOn}
              className={audioOn ? 'border-brand-500 bg-brand-50' : ''}
            >
              {audioOn ? '🔊 音あり' : '🔇 音なし'}
            </Button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-3">{children}</main>

      {footer && (
        <footer className="shrink-0 border-t-2 border-line bg-surface p-3 pb-safe">{footer}</footer>
      )}
    </div>
  )
}
