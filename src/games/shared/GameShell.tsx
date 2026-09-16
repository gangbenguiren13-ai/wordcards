import type { ScreenMode } from './GameWord'
import { useToast } from '@/components/toast/useToast'
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
  teacher = false,
  screenMode = 'handheld',
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
  teacher?: boolean
  screenMode?: ScreenMode
  progress?: { current: number; total: number }
  showProgress?: boolean
  audioEnabled?: boolean
  audioOn?: boolean
  onToggleAudio?: () => void
  onExit: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const { setGameRole } = useToast()
  useEffect(() => { setGameRole?.(teacher ? 'teacher' : 'student'); return () => setGameRole?.(null) }, [teacher, setGameRole])
  // ゲームの途中で誤ってタブを閉じたりリロードしたりすると、
  // ★を付けた記録が消えてやり直しになる。念のため確認を挟む。
  useEffect(() => {
    // 設定画面の下で開始しても、ゲームの見出しから表示する。
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const classroom = screenMode === 'classroom'
  const exitButton = <Button size="xl" onClick={onExit} aria-label="ゲームをやめる">← やめる</Button>
  const audioButton = audioEnabled && onToggleAudio && <Button size="xl" onClick={onToggleAudio}
    aria-label={audioOn ? '音を消す' : '音を出す'} aria-pressed={audioOn} className={audioOn ? 'border-brand-500 bg-brand-50' : ''}>
    {audioOn ? '🔊 音あり' : '🔇 音なし'}</Button>
  return <div data-audience={teacher ? 'teacher' : 'student'} data-screen-mode={screenMode} className="game-shell no-select flex h-dvh flex-col bg-canvas">
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-line bg-surface p-4">
      {!classroom && exitButton}
      <h1 className="min-w-0 flex-1 truncate text-center text-xl font-bold">{title}</h1>
      {showProgress && progress && <span className={`rounded-lg bg-canvas px-3 py-2 font-bold tabular-nums ${classroom ? 'text-[28px]' : 'text-xl'}`}>{progress.current}／{progress.total}</span>}
      {!classroom && audioButton}
    </header>
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</main>
    {(footer || classroom) && <footer className="shrink-0 border-t-2 border-line bg-surface p-4 pb-safe">
      {footer}
      {classroom && <div className="mt-3 flex flex-wrap justify-between gap-3">{exitButton}{audioButton}</div>}
    </footer>}
  </div>
}
