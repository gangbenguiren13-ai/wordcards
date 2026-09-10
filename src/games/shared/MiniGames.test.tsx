// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryGame } from './MemoryGame'
import { SlowRevealGame, revealClip } from './SlowRevealGame'
import { memoryCards, memorySettings, pickMemoryCards, revealSettings, canShareGame } from './miniGames'
import { memoryDefaults, slowRevealDefaults, defaultGamesConfig } from '@/lib/gameDefaults'
import type { MaterialSet } from '@/types'
import type { PreloadedCard } from '@/lib/preload'

vi.mock('@/lib/audio', () => ({ playBuffer: vi.fn().mockResolvedValue(undefined), speak: vi.fn(), stopPlayback: vi.fn() }))
const set: MaterialSet = { id: 's', owner_id: 'o', title: 'テスト', mode: 'junior', default_display: 'word_only', audio_enabled: false,
  show_word_on_answer: false, games_config: defaultGamesConfig('junior'), share_token: null, share_enabled: false, school_shared: false,
  created_at: '', updated_at: '', deleted_at: null }
const items: PreloadedCard[] = ['cat', 'dog', 'bird', 'fish', 'bear', 'lion'].map((word, i) => ({
  card: { id: `${i}`, set_id: 's', word, image_path: `i${i}`, pair_image_path: `p${i}`, audio_path: null, audio_source: null, sort_order: i, created_at: '', updated_at: '' },
  imageUrl: `blob:i${i}`, pairImageUrl: `blob:p${i}`, audio: null,
}))
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0.99999) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
describe('神経衰弱', () => {
  const mount = () => render(<MemoryGame set={set} items={items.slice(0, 4)} settings={{ ...memoryDefaults('junior'), cardCount: 8, teams: 2 }} voice={null} onExit={vi.fn()} />)
  it('不一致は900ms後に閉じ、判定中の3枚目を受け付けず次チームへ進む', () => {
    mount(); fireEvent.click(screen.getByLabelText('カード 1')); fireEvent.click(screen.getByLabelText('カード 3'))
    fireEvent.click(screen.getByLabelText('カード 5'))
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
    act(() => vi.advanceTimersByTime(899)); expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
    act(() => vi.advanceTimersByTime(1)); expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByText(/チーム2 のばん/)).toBeDefined()
  })
  it('一致すると得点が増え、同じチームが続行し、全ペアで終了する', () => {
    mount()
    for (let i = 1; i <= 8; i += 2) {
      fireEvent.click(screen.getByLabelText(`カード ${i}`)); fireEvent.click(screen.getByLabelText(`カード ${i + 1}`))
      act(() => vi.advanceTimersByTime(350))
    }
    expect(screen.getByText('ぜんぶ そろった！')).toBeDefined()
    expect(screen.getByText('チーム1：4')).toBeDefined()
  })
  it('制限時間で終了する', () => {
    render(<MemoryGame set={set} items={items.slice(0, 4)} settings={{ ...memoryDefaults('junior'), timeLimitMinutes: 1 }} voice={null} onExit={vi.fn()} />)
    act(() => vi.advanceTimersByTime(60000)); expect(screen.getByText('じかんです！')).toBeDefined()
  })
  it('関連画像を使い、小学校では単語を出さない', () => {
    render(<MemoryGame set={{ ...set, mode: 'elementary' }} items={items.slice(0, 4)} settings={{ ...memoryDefaults('elementary'), pairType: 'image_pairimage' }} voice={null} onExit={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('カード 2'))
    expect(screen.getByLabelText('カード 2 おもて').querySelector('img')?.getAttribute('src')).toBe('blob:p0')
    expect(screen.queryByText('cat')).toBeNull()
  })
})
describe('Slow Reveal', () => {
  it('自動開放を一時停止・再開でき、答えまでは単語を出さない', () => {
    render(<SlowRevealGame set={set} items={items} settings={{ ...slowRevealDefaults('junior'), order: 'sequential', advance: 'auto', autoSeconds: 1 }} voice={null} onExit={vi.fn()} />)
    expect(screen.queryByText('cat')).toBeNull()
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText('1 / 8')).toBeDefined()
    fireEvent.click(screen.getByText('一時停止')); act(() => vi.advanceTimersByTime(4000)); expect(screen.getByText('1 / 8')).toBeDefined()
    fireEvent.click(screen.getByText('再開')); act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText('2 / 8')).toBeDefined()
    fireEvent.click(screen.getByText('せいかい を みる')); expect(screen.getByText('cat')).toBeDefined()
    fireEvent.click(screen.getByText('つぎへ')); expect(screen.queryByText('cat')).toBeNull(); expect(screen.getByText('0 / 8')).toBeDefined()
  })
  it('小学校では答えも英単語を隠し、生徒に教師用ボタンを出さない', () => {
    render(<SlowRevealGame set={{ ...set, mode: 'elementary' }} items={items} settings={slowRevealDefaults('junior')} voice={null} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('せいかい を みる')); expect(screen.queryByText('cat')).toBeNull()
    expect(screen.queryByText('ぜんぶ見せる')).toBeNull()
  })
  it('中央からは円形に開き、全開時には全画像を含む', () => {
    expect(revealClip('center', 0, 8)).toBe('circle(0% at 50% 50%)')
    expect(revealClip('center', 8, 8)).toBe('circle(71% at 50% 50%)')
    expect(revealClip('top', 4, 8)).toBe('inset(0% 0% 50% 0%)')
  })
})
describe('出題と共有の条件', () => {
  it('関連画像のないカードを除き、指定ペア数だけ抽出する', () => {
    const cards = items.map(i => i.card)
    const s = { ...memoryDefaults('junior'), pairType: 'image_pairimage' as const, cardCount: 8 as const }
    expect(memoryCards([{ ...cards[0], pair_image_path: null }], s)).toHaveLength(0)
    expect(pickMemoryCards(cards, s)).toHaveLength(4)
  })
  it('小学校モードでは保存値に文字設定があっても画像にする', () => {
    expect(memorySettings({ ...set, mode: 'elementary' }).pairType).toBe('image_image')
    expect(revealSettings({ ...set, mode: 'elementary' }).answerDisplay).toBe('image')
  })
  it('フラッシュカードを公開しなくても神経衰弱を共有できる', () => {
    const s = { ...set, games_config: { memory: set.games_config.memory } }
    expect(canShareGame(s, items.map(i => i.card))).toBe(true)
    expect(canShareGame(s, items.slice(0, 3).map(i => i.card))).toBe(false)
  })
})
