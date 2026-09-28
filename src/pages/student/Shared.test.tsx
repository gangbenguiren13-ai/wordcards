// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SharedPage } from './Shared'
import { fetchSharedSet, sharedGameData, SharedError, type SharedPayload } from '@/api/shared'
import { defaultGamesConfig } from '@/lib/gameDefaults'
import { preloadCards, releasePreloaded } from '@/lib/preload'

vi.mock('@/api/shared', async (original) => ({ ...await original<typeof import('@/api/shared')>(), fetchSharedSet: vi.fn() }))
vi.mock('@/lib/audio', () => ({ unlockAudio: vi.fn().mockResolvedValue(undefined), loadVoices: vi.fn().mockResolvedValue([]), pickVoice: vi.fn().mockReturnValue(null), stopPlayback: vi.fn() }))
vi.mock('@/lib/preload', () => ({ preloadCards: vi.fn(), releasePreloaded: vi.fn() }))
vi.mock('@/games/flashcards/FlashcardsGame', () => ({ FlashcardsGame: ({ set, settings, onExit }: { set: { mode: string }; settings: { order: string }; onExit: () => void }) =>
  <div>ゲーム開始 {set.mode} {settings.order}<button onClick={onExit}>やめる</button></div> }))

function payload(): SharedPayload {
  return { set: { title: 'どうぶつ', mode: 'junior', defaultDisplay: 'word_only', audioEnabled: true,
    showWordOnAnswer: false, gamesConfig: defaultGamesConfig('junior') },
  cards: [{ id: 'a', word: 'cat', imageUrl: null, pairImageUrl: null, audioUrl: null, sortOrder: 0 }] }
}
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/p/abcdefghijklmnopqrstu']}><Routes>
      <Route path="/p/:token" element={<SharedPage />} />
    </Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(fetchSharedSet).mockResolvedValue(payload())
  vi.mocked(preloadCards).mockResolvedValue({ items: [], failures: [] })
})
afterEach(cleanup)

async function chooseFlashcards() {
  fireEvent.click(await screen.findByRole('button', { name: 'フラッシュカードで あそぶ' }))
}

function allGamesPayload() {
  const p = payload()
  p.cards = Array.from({ length: 6 }, (_, i) => ({ ...p.cards[0], id: String(i), word: `word${i}`, imageUrl: `https://example.invalid/${i}` }))
  p.set.gamesConfig.slowreveal!.enabledForStudents = true
  return p
}

describe('匿名の共有ページ', () => {
  it('公開された3ゲームを同列に選べて、それぞれの設定から戻れる', async () => {
    vi.mocked(fetchSharedSet).mockResolvedValue(allGamesPayload())
    mount()
    for (const name of ['フラッシュカードで あそぶ', 'しんけいすいじゃくで あそぶ', 'ゆっくりみえるゲームで あそぶ']) {
      fireEvent.click(await screen.findByRole('button', { name }))
      expect(screen.getByRole('button', { name: '▶ はじめる' })).toBeDefined()
      fireEvent.click(screen.getByRole('button', { name: '← ゲームえらびへ' }))
    }
    await screen.findByRole('heading', { name: 'ゲームをえらぶ' })
    expect(screen.queryByRole('button', { name: '▶ はじめる' })).toBeNull()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
  it('非公開ゲームは一覧に出さない', async () => {
    const p = allGamesPayload(); p.set.gamesConfig.slowreveal!.enabledForStudents = false
    vi.mocked(fetchSharedSet).mockResolvedValue(p); mount()
    await screen.findByRole('button', { name: 'フラッシュカードで あそぶ' })
    expect(screen.queryByRole('button', { name: 'ゆっくりみえるゲームで あそぶ' })).toBeNull()
  })
  it('生徒が3人協力を選べて、読み込み失敗から再試行しても人数を引き継ぐ', async () => {
    const p = allGamesPayload(); p.set.audioEnabled = false
    const original = structuredClone(p)
    vi.mocked(fetchSharedSet).mockResolvedValue(p)
    vi.mocked(preloadCards).mockResolvedValueOnce({ items: [], failures: [{ cardId: '0', reason: 'timeout' }] })
      .mockResolvedValue({ items: sharedGameData(p).cards.map(card => ({ card, imageUrl: 'blob:test', pairImageUrl: null, audio: null })), failures: [] })
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'しんけいすいじゃくで あそぶ' }))
    fireEvent.click(screen.getByRole('button', { name: '3にんで きょうりょく' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: '3にんで きょうりょく' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    await screen.findByText('3にんで きょうりょく・1ばんの ひとのばん')
    expect(screen.getByText('みんなで そろえたペア：0')).toBeDefined()
    expect(screen.getAllByRole('button', { name: /^カード \d+$/ })).toHaveLength(12)
    expect(localStorage.length).toBe(0)
    expect(p).toEqual(original)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
  it('無効URL・共有停止の404には再読込も教師リンクも出さない', async () => {
    vi.mocked(fetchSharedSet).mockRejectedValue(new SharedError(404))
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('先生に みせてください')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
  it('通信失敗は再読み込みでき、混雑は通信と区別する', async () => {
    expect(new SharedError(404).code).toBe('NOT_FOUND')
    expect(new SharedError(503).code).toBe('NETWORK')
    expect(new SharedError(429).code).toBe('BUSY')
    vi.mocked(fetchSharedSet).mockRejectedValue(new SharedError(503))
    mount()
    await screen.findByRole('button', { name: 'もういちど よみこむ' })
    expect((await screen.findByRole('alert')).textContent).toContain('通信を')
  })
  it('神経衰弱でも開始直前に最新の公開設定を確認する', async () => {
    const p = payload()
    p.cards = Array.from({ length: 6 }, (_, i) => ({ ...p.cards[0], id: String(i), word: `word${i}`, imageUrl: `https://example.invalid/${i}` }))
    const stopped = structuredClone(p); stopped.set.gamesConfig.memory!.enabledForStudents = false
    vi.mocked(fetchSharedSet).mockResolvedValueOnce(p).mockResolvedValueOnce(stopped)
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'しんけいすいじゃくで あそぶ' }))
    expect(screen.queryByText('ペアの種類')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    expect((await screen.findByRole('alert')).textContent).toContain('おやすみちゅう')
    expect(preloadCards).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
  it('教師用リンクを出さず、開始時にも共有状態を確認する', async () => {
    localStorage.setItem('wordcards.flashcards.settings', JSON.stringify({ order: 'random' }))
    mount(); await chooseFlashcards(); fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    await screen.findByText('ゲーム開始 junior sequential')
    expect(fetchSharedSet).toHaveBeenCalledTimes(2)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
  it('開始前に共有が停止された場合はゲームを開始しない', async () => {
    vi.mocked(fetchSharedSet).mockResolvedValueOnce(payload()).mockRejectedValueOnce(new SharedError(404))
    mount(); await chooseFlashcards(); fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    expect((await screen.findByRole('alert')).textContent).toContain('このQRコードは つかえません')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(preloadCards).not.toHaveBeenCalled()
  })
  it('教師が非公開にしたゲームは開始ボタンを出さない', async () => {
    const p = payload(); p.set.gamesConfig.flashcards!.enabledForStudents = false
    vi.mocked(fetchSharedSet).mockResolvedValue(p); mount()
    await screen.findByText(/いま つかえるゲームは/)
    expect(screen.queryByRole('button', { name: '▶ はじめる' })).toBeNull()
  })
  it('読み込み失敗後に再試行できる', async () => {
    vi.mocked(fetchSharedSet).mockRejectedValueOnce(new SharedError(503)).mockResolvedValue(payload())
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'もういちど よみこむ' }))
    await screen.findByRole('button', { name: 'フラッシュカードで あそぶ' })
  })
  it('メディア失敗時に解放して再試行できる', async () => {
    vi.mocked(preloadCards).mockResolvedValueOnce({ items: [], failures: [{ cardId: 'a', reason: 'timeout' }] })
      .mockResolvedValue({ items: [], failures: [] })
    mount(); await chooseFlashcards(); fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    fireEvent.click(await screen.findByRole('button', { name: 'もういちど はじめる' }))
    await screen.findByText('ゲーム開始 junior sequential')
    expect(releasePreloaded).toHaveBeenCalled()
  })
  it('取得中にページを離れた場合もBlobを解放する', async () => {
    let finish!: (result: Awaited<ReturnType<typeof preloadCards>>) => void
    vi.mocked(preloadCards).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const view = mount(); await chooseFlashcards(); fireEvent.click(screen.getByRole('button', { name: '▶ はじめる' }))
    await waitFor(() => expect(preloadCards).toHaveBeenCalled())
    view.unmount(); finish({ items: [], failures: [] })
    await waitFor(() => expect(releasePreloaded).toHaveBeenCalled())
  })
})
