// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QuickStart, rememberStarted } from './QuickStart'

beforeEach(() => localStorage.clear())
afterEach(cleanup)
function mount(game = 'flashcards') {
  const start = vi.fn()
  return { start, view: render(<QuickStart game={game} count={10} summary="ランダム・手で送る・復習を混ぜる・音あり" onStart={start}>
    <label>出す順番<input aria-label="出す順番" /></label>
  </QuickStart>) }
}
it('初回は展開し、2回目は要約と開始ボタンだけで始められる', () => {
  const first = mount()
  expect(screen.getByRole('button', { name: '▾ 設定を閉じる' }).getAttribute('aria-expanded')).toBe('true')
  first.view.unmount(); rememberStarted('flashcards')
  const second = mount()
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '前回と同じ設定ではじめる（10枚）' }))
  expect(second.start).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('設定の要約').textContent).toContain('復習を混ぜる')
  fireEvent.click(screen.getByRole('button', { name: '▸ 設定を変える' }))
  expect(screen.getByRole('textbox')).toBeDefined()
})
it('開閉の選択を再訪後もゲームごとに保存する', () => {
  const first = mount(); fireEvent.click(screen.getByRole('button', { name: '▾ 設定を閉じる' }))
  first.view.unmount()
  const second = mount(); expect(screen.queryByRole('textbox')).toBeNull()
  second.view.unmount(); mount('memory')
  expect(screen.getByRole('textbox')).toBeDefined()
})
