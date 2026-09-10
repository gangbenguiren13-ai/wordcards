// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GamePlayPage } from './GamePlay'
import { PlaySelectPage } from './PlaySelect'
import { getSet, getCards } from '@/api/sets'
import { preloadCards, releasePreloaded } from '@/lib/preload'
import { unlockAudio } from '@/lib/audio'
import type { Card, MaterialSet } from '@/types'

const showToast = vi.hoisted(() => vi.fn())
vi.mock('@/api/sets', () => ({ getSet: vi.fn(), getCards: vi.fn() }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <header>WordCards</header> }))
vi.mock('@/components/toast/useToast', () => ({ useToast: () => ({ show: showToast }) }))
vi.mock('@/lib/mediaStore', () => ({ signedUrls: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/preload', () => ({ preloadCards: vi.fn(), releasePreloaded: vi.fn() }))
vi.mock('@/lib/audio', () => ({
  loadVoices: vi.fn().mockResolvedValue([]), englishVoices: () => [], pickVoice: () => null,
  saveVoiceUri: vi.fn(), speak: vi.fn(), unlockAudio: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/games/flashcards/FlashcardsGame', () => ({ FlashcardsGame: () => <p>ゲーム開始済み</p> }))

const material: MaterialSet = {
  id: 'set1', owner_id: 'teacher1', title: '検査用', mode: 'junior',
  default_display: 'word_only', audio_enabled: false, show_word_on_answer: false,
  games_config: {}, share_token: null, share_enabled: false, school_shared: false,
  created_at: '', updated_at: '', deleted_at: null,
}
const card: Card = {
  id: 'card1', set_id: 'set1', word: 'apple', image_path: null,
  pair_image_path: null, audio_path: null, audio_source: null, sort_order: 0,
  created_at: '', updated_at: '',
}
const clients: QueryClient[] = []
function openPage(selection = false, game = 'flashcards') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  clients.push(client)
  const path = selection ? '/t/sets/set1/play' : `/t/sets/set1/play/${game}`
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/t/sets/:id/play" element={<PlaySelectPage />} />
          <Route path="/t/sets/:id/play/:game" element={<GamePlayPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(getSet).mockResolvedValue(material)
  vi.mocked(getCards).mockResolvedValue([card])
  vi.mocked(unlockAudio).mockResolvedValue(undefined)
  vi.mocked(preloadCards).mockResolvedValue({ items: [{ card, imageUrl: null, audio: null }], failures: [] })
})
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()) })

describe('教材読み込みの失敗と再試行', () => {
  it.each([false, true])('カード取得の通信失敗を表示し、再試行で復帰する（選択画面=%s）', async (selection) => {
    vi.mocked(getCards).mockRejectedValueOnce(new Error('Failed to fetch'))
    openPage(selection)
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.queryByText(/カードがまだありません/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }))
    if (selection) expect(await screen.findByRole('link', { name: /フラッシュカード/ })).toBeDefined()
    else expect(await screen.findByRole('button', { name: 'はじめる（1枚）' })).toBeDefined()
  })
  it('セット取得の失敗で読み込み中のまま止まらない', async () => {
    vi.mocked(getSet).mockRejectedValueOnce(new Error('Failed to fetch'))
    openPage()
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.getByRole('button', { name: 'もう一度読み込む' })).toBeDefined()
  })
  it('直接URLを開いても未入力カードのある教材では開始できない', async () => {
    vi.mocked(getCards).mockResolvedValue([{ ...card, word: '' }])
    openPage()
    expect((await screen.findByRole('alert')).textContent).toContain('未入力')
    expect(screen.queryByRole('button', { name: /はじめる/ })).toBeNull()
  })
  it('未実装ゲームのURLではフラッシュカードを開始しない', async () => {
    openPage(false, 'whatsmissing')
    expect((await screen.findByRole('alert')).textContent).toContain('準備中')
    expect(screen.queryByRole('button', { name: /はじめる/ })).toBeNull()
  })
  it('画像取得の失敗で空白ゲームへ進まず、解放して再試行できる', async () => {
    const failedItems = [{ card, imageUrl: 'blob:failed-test', audio: null }]
    vi.mocked(preloadCards).mockResolvedValueOnce({ items: failedItems, failures: [{ cardId: card.id, reason: '画像 503' }] })
    openPage()
    fireEvent.click(await screen.findByRole('button', { name: 'はじめる（1枚）' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('読み込めませんでした')))
    expect(releasePreloaded).toHaveBeenCalledWith(failedItems)
    expect(screen.queryByText('ゲーム開始済み')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'はじめる（1枚）' }))
    expect(await screen.findByText('ゲーム開始済み')).toBeDefined()
  })
  it('音声初期化の失敗も画面に通知し、開始前へ戻す', async () => {
    vi.mocked(unlockAudio).mockRejectedValueOnce(new Error('Audio unavailable'))
    openPage()
    fireEvent.click(await screen.findByRole('button', { name: 'はじめる（1枚）' }))
    await waitFor(() => expect(showToast).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'はじめる（1枚）' })).toBeDefined()
    expect(preloadCards).not.toHaveBeenCalled()
  })
})
