// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './Home'
import { PlaySelectPage } from './PlaySelect'
import { GamePlayPage } from './GamePlay'
import { listSets, getCards, getSet, softDeleteSet, type SetListItem } from '@/api/sets'
import { recentSets, rememberUsed, matchesTitle } from '@/lib/recentSets'
import { preloadCards } from '@/lib/preload'
import type { Card } from '@/types'

vi.mock('@/api/sets', () => ({ listSets: vi.fn(), listTrash: vi.fn().mockResolvedValue([]), getCards: vi.fn(), getSet: vi.fn(), createSet: vi.fn(), softDeleteSet: vi.fn(), duplicateSet: vi.fn(), restoreSet: vi.fn() }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <header>WordCards</header> }))
vi.mock('@/lib/mediaStore', () => ({ signedUrls: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/preload', () => ({ preloadCards: vi.fn().mockResolvedValue({ items: [], failures: [] }), releasePreloaded: vi.fn() }))
vi.mock('@/lib/audio', () => ({ loadVoices: vi.fn().mockResolvedValue([]), englishVoices: () => [], pickVoice: () => null, unlockAudio: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/games/flashcards/FlashcardsGame', () => ({ FlashcardsGame: () => <p>ゲーム開始済み</p> }))
const sets = Array.from({ length: 87 }, (_, i) => ({ id: `s${i}`, owner_id: 'teacher', title: i === 86 ? 'Nature しぜん' : `教材${i}`, mode: 'junior', default_display: 'word_only', card_count: 1, games_config: {}, audio_enabled: false, deleted_at: null } as SetListItem))
const clients: QueryClient[] = []
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client)
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/t/home']}><Routes>
    <Route path="/t/home" element={<HomePage />} /><Route path="/t/sets/:id/play" element={<PlaySelectPage />} />
    <Route path="/t/sets/:id/play/:game" element={<GamePlayPage />} />
  </Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(listSets).mockResolvedValue(sets); vi.mocked(getSet).mockResolvedValue(sets[86])
  vi.mocked(getCards).mockResolvedValue([{ id: 'c', set_id: 's86', word: 'leaf', image_path: null, audio_path: null, pair_image_path: null, sort_order: 0 } as Card])
})
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()) })
it('87件を連続入力で検索し、編集を経由せず3タップで開始できる', async () => {
  mount(); await screen.findByText('すべての教材（87）')
  const input = screen.getByRole('searchbox', { name: 'セット名でさがす' })
  await userEvent.type(input, 'nature')
  expect(document.activeElement).toBe(input)
  expect((input as HTMLInputElement).value).toBe('nature')
  expect(within(screen.getByRole('list', { name: '教材セット一覧' })).getAllByRole('listitem')).toHaveLength(1)
  fireEvent.click(screen.getByRole('link', { name: '▶ あそぶ' }))
  fireEvent.click(await screen.findByRole('link', { name: /フラッシュカード/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'はじめる（1枚）' }))
  await screen.findByText('ゲーム開始済み')
  expect(preloadCards).toHaveBeenCalledOnce()
  expect(recentSets(sets).map(s => s.id)).toEqual(['s86'])
})
it('削除はその他メニューと確認の両方を経由する', async () => {
  mount(); await screen.findByText('すべての教材（87）')
  expect(screen.queryByRole('button', { name: 'ゴミ箱に入れる' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Nature しぜんのその他の操作' }))
  fireEvent.click(screen.getByRole('button', { name: 'ゴミ箱に入れる' }))
  expect(softDeleteSet).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ゴミ箱に入れる' }))
  await waitFor(() => expect(softDeleteSet).toHaveBeenCalledWith('s86'))
})
it('最近つかったは有効な3件だけを使用順で表示し、検索0件から戻せる', async () => {
  for (let i = 0; i < 5; i++) rememberUsed('teacher', `s${i}`, i)
  rememberUsed('teacher', 's3', 10); rememberUsed('other', 's86', 30); rememberUsed('teacher', 'deleted', 40)
  expect(recentSets(sets).map(s => s.id)).toEqual(['s3', 's4', 's2'])
  mount(); await screen.findByRole('region', { name: '最近つかった' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '存在しない' } })
  expect(screen.getByText(/見つかりません。検索を/)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: '検索をクリアする' }))
  expect(screen.getByRole('region', { name: '最近つかった' })).toBeDefined()
  expect(matchesTitle('スポーツ', 'すぽーつ')).toBe(true)
})
