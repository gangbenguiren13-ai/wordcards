// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FlashcardsGame } from '../flashcards/FlashcardsGame'
import { MemoryGame } from './MemoryGame'
import { SlowRevealGame } from './SlowRevealGame'
import { LoadingProgress } from '@/components/LoadingProgress'
import { defaultGamesConfig, FLASHCARDS_DEFAULTS, memoryDefaults, slowRevealDefaults } from '@/lib/gameDefaults'
import type { MaterialSet } from '@/types'
import type { PreloadedCard } from '@/lib/preload'

vi.mock('@/lib/audio', () => ({ playBuffer: vi.fn(), speak: vi.fn(), speechAvailable: () => true, stopPlayback: vi.fn(), resetSpeech: vi.fn() }))
const set: MaterialSet = { id: 's', owner_id: 'o', title: 'どうぶつ', mode: 'elementary', default_display: 'image_only', audio_enabled: false, show_word_on_answer: true,
  games_config: defaultGamesConfig('elementary'), share_token: null, share_enabled: false, school_shared: false, created_at: '', updated_at: '', deleted_at: null }
const items: PreloadedCard[] = ['cat', 'dog'].map((word, i) => ({ card: { id: String(i), set_id: 's', word, image_path: 'image', pair_image_path: null, audio_path: null, audio_source: null, sort_order: i, created_at: '', updated_at: '' }, imageUrl: `blob:image-${i}`, pairImageUrl: null, audio: null }))
const noEnglish = () => { expect(document.body.textContent).not.toMatch(/[A-Za-z]/); expect(document.querySelectorAll('a')).toHaveLength(0) }
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(.99999) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('小学校フラッシュカードと復習付き終了画面は英字なし。次の画像は待ち時間なしで変わる', () => {
  render(<FlashcardsGame set={set} items={items} settings={{ ...FLASHCARDS_DEFAULTS, display: 'word_image', order: 'sequential', advance: 'manual', audioAutoplay: false }} voice={null} onExit={vi.fn()} />)
  noEnglish(); fireEvent.click(screen.getByRole('button', { name: '☆ もういちど' }))
  fireEvent.click(screen.getByRole('button', { name: '次のカード' }))
  expect(document.querySelector('.flash-face img')?.getAttribute('src')).toBe('blob:image-1')
  noEnglish(); act(() => vi.advanceTimersByTime(250)); fireEvent.click(screen.getByRole('button', { name: '次のカード' }))
  expect(screen.getByRole('button', { name: 'のカードだけ もういちど' })).toBeDefined(); noEnglish()
})
it('小学校神経衰弱は盤面と結果に英字なし。成立後の350msロックを保つ', () => {
  render(<MemoryGame set={set} items={items} settings={memoryDefaults('elementary')} cooperativePlayers={3} voice={null} onExit={vi.fn()} />)
  noEnglish(); fireEvent.click(screen.getByLabelText('カード 1')); fireEvent.click(screen.getByLabelText('カード 2'))
  act(() => vi.advanceTimersByTime(349)); fireEvent.click(screen.getByLabelText('カード 3'))
  expect(screen.getByLabelText('カード 3').getAttribute('aria-pressed')).toBe('false')
  act(() => vi.advanceTimersByTime(1)); fireEvent.click(screen.getByLabelText('カード 3'))
  expect(screen.getByLabelText('カード 3 おもて').getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByLabelText('カード 4')); noEnglish()
  fireEvent.click(screen.getByRole('button', { name: 'けっかを みる' })); noEnglish()
  expect(screen.getByText('2 / 2ペア・0びょう')).toBeDefined()
})
it('小学校ゆっくりみえるは答えと終了にも英字なし', () => {
  render(<SlowRevealGame set={set} items={items.slice(0, 1)} settings={slowRevealDefaults('junior')} voice={null} onExit={vi.fn()} />)
  noEnglish(); fireEvent.click(screen.getByRole('button', { name: 'せいかい を みる' })); noEnglish()
  fireEvent.click(screen.getByRole('button', { name: 'つぎへ' })); expect(screen.getByText('おしまい！')).toBeDefined(); noEnglish()
})
it.each([1, 3])('小学校の%d人プレイでは結果のペア数と経過時間が残る', players => {
  render(<MemoryGame set={set} items={items.slice(0, 1)} settings={memoryDefaults('elementary')} cooperativePlayers={players} voice={null} onExit={vi.fn()} />)
  act(() => vi.advanceTimersByTime(7000))
  fireEvent.click(screen.getByLabelText('カード 1')); fireEvent.click(screen.getByLabelText('カード 2'))
  fireEvent.click(screen.getByRole('button', { name: 'けっかを みる' }))
  expect(screen.getByText('1 / 1ペア・7びょう')).toBeDefined(); noEnglish()
})
it('小学校の2チーム対抗は時間切れでも両チームの得点と結果を表示する', () => {
  render(<MemoryGame set={set} items={items} settings={{ ...memoryDefaults('elementary'), teams: 2, timeLimitMinutes: 1 }} voice={null} onExit={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('カード 1')); fireEvent.click(screen.getByLabelText('カード 3'))
  act(() => vi.advanceTimersByTime(900))
  fireEvent.click(screen.getByLabelText('カード 1')); fireEvent.click(screen.getByLabelText('カード 2'))
  act(() => vi.advanceTimersByTime(59100))
  fireEvent.click(screen.getByRole('button', { name: 'けっかを みる' }))
  expect(screen.getByText('1 / 2ペア・60びょう')).toBeDefined()
  expect(screen.getByText('チーム1：0')).toBeDefined(); expect(screen.getByText('チーム2：1')).toBeDefined(); noEnglish()
})
it('表裏を切り替えるたびに面を作り直すが、単語と画像は即時に切り替わる', () => {
  render(<FlashcardsGame set={{ ...set, mode: 'junior' }} items={items} settings={{ ...FLASHCARDS_DEFAULTS, display: 'front_word_back_image', order: 'sequential', advance: 'manual', audioAutoplay: false }} voice={null} onExit={vi.fn()} />)
  const before = document.querySelector('.flash-face')
  expect(screen.getByText('cat')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'うらを みる' }))
  const back = document.querySelector('.flash-face')
  expect(back).not.toBe(before); expect(screen.queryByText('cat')).toBeNull()
  expect(back?.querySelector('img')?.getAttribute('src')).toBe('blob:image-0')
  fireEvent.click(screen.getByRole('button', { name: 'うらを みる' }))
  expect(document.querySelector('.flash-face')).not.toBe(back); expect(screen.getByText('cat')).toBeDefined()
})
it('表裏ありでも「つぎへ」「まえへ」は入ってくる動き、回り込みは表裏の切りかえだけ。どちらも表示は即時', () => {
  render(<FlashcardsGame set={{ ...set, mode: 'junior' }} items={items} settings={{ ...FLASHCARDS_DEFAULTS, display: 'front_word_back_image', order: 'sequential', advance: 'manual', audioAutoplay: false }} voice={null} onExit={vi.fn()} />)
  const face = () => document.querySelector('.flash-face')!
  expect(face().classList.contains('flash-face--turn')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'うらを みる' }))
  expect(face().classList.contains('flash-face--turn')).toBe(true); expect(face().querySelector('img')?.getAttribute('src')).toBe('blob:image-0')
  fireEvent.click(screen.getByRole('button', { name: '次のカード' }))
  expect(face().classList.contains('flash-face--turn')).toBe(false); expect(screen.getByText('dog')).toBeDefined()
  act(() => vi.advanceTimersByTime(250)); fireEvent.keyDown(window, { key: 'ArrowUp' })
  expect(face().classList.contains('flash-face--turn')).toBe(true); expect(face().querySelector('img')?.getAttribute('src')).toBe('blob:image-1')
  fireEvent.click(screen.getByRole('button', { name: '前のカード' }))
  expect(face().classList.contains('flash-face--turn')).toBe(false); expect(screen.getByText('cat')).toBeDefined()
})
it('生徒の読み込みでは音声オンの時だけ発話案内、3秒後の案内も維持する', () => {
  const view = render(<LoadingProgress student done={2} total={4} />)
  noEnglish(); expect(screen.queryByText('きこえたら、まねして いってみよう')).toBeNull()
  act(() => vi.advanceTimersByTime(2999)); expect(screen.queryByText(/すこし じかんが/)).toBeNull()
  act(() => vi.advanceTimersByTime(1)); expect(screen.getByText(/すこし じかんが/)).toBeDefined()
  view.rerender(<LoadingProgress student audioEnabled done={2} total={4} />)
  expect(screen.getByText('きこえたら、まねして いってみよう')).toBeDefined(); noEnglish()
})
