// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from './toast/ToastProvider'
import { useToast } from './toast/useToast'
import { AppHeader } from './AppHeader'
import { ActionError } from './ActionError'
import { LoadingProgress } from './LoadingProgress'
import { GameShell } from '@/games/shared/GameShell'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })
function Controls() {
  const toast = useToast()
  return <><button onClick={() => toast.show('保存しました', 'success')}>保存を試す</button><button onClick={() => toast.show('通信失敗')}>失敗を試す</button></>
}
it('保存成功はヘッダー右端に1.5秒だけ出し、下部トーストは出さない', () => {
  render(<MemoryRouter><ToastProvider><AppHeader /><Controls /></ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByText('保存を試す'))
  expect(screen.getByText('✓ 保存済み').closest('header')).not.toBeNull()
  expect(screen.queryByText('保存しました')).toBeNull()
  act(() => vi.advanceTimersByTime(1499)); expect(screen.getByText('✓ 保存済み')).toBeDefined()
  act(() => vi.advanceTimersByTime(1)); expect(screen.queryByText('✓ 保存済み')).toBeNull()
})
it('操作直下の失敗は残り、再試行と閉じるができる', () => {
  const retry = vi.fn()
  function Example() { const [error, setError] = useState('通信失敗'); return <><button>保存する</button><ActionError error={error} onRetry={retry} onDismiss={() => setError('')} /></> }
  render(<Example />)
  act(() => vi.advanceTimersByTime(30000)); expect(screen.getByRole('alert')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'もう一度ためす' })); expect(retry).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'メッセージを閉じる' })); expect(screen.queryByRole('alert')).toBeNull()
})
it('共通の失敗トーストも編集画面では閉じるまで残る', () => {
  render(<MemoryRouter initialEntries={['/t/home']}><ToastProvider><Controls /></ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByText('失敗を試す'))
  act(() => vi.advanceTimersByTime(30000)); expect(screen.getByRole('alert')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: '通知を閉じる' })); expect(screen.queryByRole('alert')).toBeNull()
})
it.each([true, false])('ゲーム通知は教師だけ表示し3秒で消す（教師=%s）', teacher => {
  render(<MemoryRouter initialEntries={[teacher ? '/t/sets/s/play/flashcards' : '/p/token']}><ToastProvider>
    <GameShell title="テスト" teacher={teacher} onExit={() => {}}><Controls /></GameShell>
  </ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByText('失敗を試す'))
  expect(screen.queryByRole('alert') !== null).toBe(teacher)
  act(() => vi.advanceTimersByTime(3000)); expect(screen.queryByRole('alert')).toBeNull()
})
it('読み込み内容と枚数を表示し、3秒後だけ遅延を案内する', () => {
  render(<LoadingProgress done={12} total={20} label="カードを よみこみちゅう" />)
  expect(screen.getByText('カードを よみこみちゅう 12／20枚')).toBeDefined()
  expect(screen.queryByText(/時間がかかっています/)).toBeNull()
  act(() => vi.advanceTimersByTime(3000)); expect(screen.getByText(/時間がかかっています/)).toBeDefined()
})

it('管理画面から持ち越した通知も教師ゲーム開始後は3秒で消す', () => {
  function Example() {
    const [playing, setPlaying] = useState(false)
    return playing ? <GameShell teacher title="テスト" onExit={() => {}}><Controls /></GameShell>
      : <><Controls /><button onClick={() => setPlaying(true)}>ゲームを開始</button></>
  }
  render(<MemoryRouter><ToastProvider><Example /></ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByText('失敗を試す'))
  act(() => vi.advanceTimersByTime(30000)); expect(screen.getByRole('alert')).toBeDefined()
  fireEvent.click(screen.getByText('ゲームを開始'))
  act(() => vi.advanceTimersByTime(2999)); expect(screen.getByRole('alert')).toBeDefined()
  act(() => vi.advanceTimersByTime(1)); expect(screen.queryByRole('alert')).toBeNull()
})
