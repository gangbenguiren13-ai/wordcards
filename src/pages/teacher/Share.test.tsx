// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SharePage } from './Share'
import { getCards, getSet, issueShareToken, updateSet } from '@/api/sets'
import { defaultGamesConfig } from '@/lib/gameDefaults'
import type { Card, MaterialSet } from '@/types'
vi.mock('@/api/sets', () => ({ getCards: vi.fn(), getSet: vi.fn(), issueShareToken: vi.fn(), updateSet: vi.fn() }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <header>教師用</header> }))
const token = 'abcdefghijklmnopqrstu'
let current: MaterialSet
beforeEach(() => {
  vi.clearAllMocks()
  current = { id: 's', owner_id: 'o', title: '動物', mode: 'junior', default_display: 'word_only', audio_enabled: true,
    show_word_on_answer: false, games_config: defaultGamesConfig('junior'), share_token: token,
    share_enabled: false, school_shared: false, created_at: '', updated_at: '', deleted_at: null }
  vi.mocked(getSet).mockImplementation(async () => ({ ...current }))
  vi.mocked(getCards).mockResolvedValue([{ id: 'c', set_id: 's', word: 'cat', image_path: null, pair_image_path: null,
    audio_path: null, audio_source: null, sort_order: 0, created_at: '', updated_at: '' } satisfies Card])
  vi.mocked(updateSet).mockImplementation(async (_, patch) => { Object.assign(current, patch) })
  vi.mocked(issueShareToken).mockImplementation(async () => { current.share_token = 'uvwxyzabcdefghijklmno'; current.share_enabled = true; return current.share_token })
})
afterEach(cleanup)
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
  <MemoryRouter initialEntries={['/t/sets/s/share']}><Routes><Route path="/t/sets/:id/share" element={<SharePage />} /></Routes></MemoryRouter>
</QueryClientProvider>) }
it('停止中の同じリンクを再開しQRを表示する', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: '同じリンクで共有を再開する' }))
  await screen.findByRole('img', { name: '生徒用共有リンクのQRコード' })
  expect(updateSet).toHaveBeenCalledWith('s', { share_enabled: true })
  expect(issueShareToken).not.toHaveBeenCalled()
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('/p/' + token)
})
it('共有停止後はQRとリンクを表示しない', async () => {
  current.share_enabled = true; mount()
  fireEvent.click(await screen.findByRole('button', { name: '共有を停止する' }))
  await waitFor(() => expect(screen.queryByRole('img')).toBeNull())
  expect(current.share_token).toBe(token)
  expect(screen.queryByRole('textbox')).toBeNull()
})
it('再発行は確認操作の後だけ行い、新しいリンクへ切り替える', async () => {
  current.share_enabled = true; mount()
  fireEvent.click(await screen.findByRole('button', { name: 'URLを作り直す' }))
  expect(issueShareToken).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: '作り直して共有する' }))
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('uvwxyzabcdefghijklmno'))
})
it('共有直前に教材が未完成になっていたら発行しない', async () => {
  mount(); const enable = await screen.findByRole('button', { name: '同じリンクで共有を再開する' })
  current.title = ''; fireEvent.click(enable)
  await screen.findByRole('alert')
  expect(updateSet).not.toHaveBeenCalled(); expect(issueShareToken).not.toHaveBeenCalled()
})
it('共有失敗を表示し停止中の状態を維持する', async () => {
  vi.mocked(updateSet).mockRejectedValue(new Error('通信エラー'))
  mount(); fireEvent.click(await screen.findByRole('button', { name: '同じリンクで共有を再開する' }))
  await screen.findByRole('alert'); expect(screen.queryByRole('img')).toBeNull()
})
