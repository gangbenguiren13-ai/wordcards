// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { FlashcardsGame } from './FlashcardsGame'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import type { MaterialSet, Card, SetMode, DisplayMode } from '@/types'
import type { PreloadedCard } from '@/lib/preload'

// 音声はブラウザAPIに依存するので、呼ばれたことだけ確認できるように差し替える
const speakMock = vi.fn()
vi.mock('@/lib/audio', () => ({
  playBuffer: vi.fn().mockResolvedValue(undefined),
  stopPlayback: vi.fn(),
  resetSpeech: vi.fn(),
  speak: (...args: unknown[]) => speakMock(...args),
}))

function makeSet(over: Partial<MaterialSet> = {}): MaterialSet {
  return {
    id: 's', owner_id: 'o', title: 'どうぶつ',
    mode: (over.mode ?? 'junior') as SetMode,
    default_display: (over.default_display ?? 'word_image') as DisplayMode,
    audio_enabled: over.audio_enabled ?? false,
    show_word_on_answer: over.show_word_on_answer ?? false,
    games_config: {}, share_token: null, share_enabled: false, school_shared: false,
    created_at: '', updated_at: '', deleted_at: null,
  }
}

function makeItems(words: string[]): PreloadedCard[] {
  return words.map((w, i) => {
    const card: Card = {
      id: `c${i}`, set_id: 's', word: w,
      image_path: `p/${i}.webp`, pair_image_path: null,
      audio_path: null, audio_source: null, sort_order: i,
      created_at: '', updated_at: '',
    }
    return { card, imageUrl: `blob:img${i}`, audio: null }
  })
}

const baseProps = {
  settings: { ...FLASHCARDS_DEFAULTS, showProgress: true, order: 'sequential' as const },
  voice: null,
  onExit: vi.fn(),
}

beforeEach(() => {
  cleanup()
  speakMock.mockClear()
})

describe('FlashcardsGame', () => {
  it('最初のカードと進捗を表示する', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat', 'bird'])} {...baseProps} />)
    expect(screen.getByText('dog')).toBeDefined()
    expect(screen.getByText('1／3')).toBeDefined()
  })

  it('「つぎへ」で次のカードに進む', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat'])} {...baseProps} />)
    fireEvent.click(screen.getByLabelText('次のカード'))
    expect(screen.getByText('cat')).toBeDefined()
    expect(screen.getByText('2／2')).toBeDefined()
  })

  it('最初のカードでは「前へ」が押せない', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat'])} {...baseProps} />)
    expect(screen.getByLabelText('前のカード').hasAttribute('disabled')).toBe(true)
  })

  it('進捗表示をオフにすると出ない', () => {
    render(
      <FlashcardsGame
        set={makeSet()} items={makeItems(['dog', 'cat'])}
        {...baseProps} settings={{ ...baseProps.settings, showProgress: false }}
      />,
    )
    expect(screen.queryByText('1／2')).toBeNull()
  })

  it('★を付けると見た目が変わる', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog'])} {...baseProps} />)
    const btn = screen.getByRole('button', { name: '☆ もういちど', pressed: false })
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: '★ もういちど', pressed: true })).toBeDefined()
  })

  it('最後まで送ると終了画面になる', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat'])} {...baseProps} />)
    fireEvent.click(screen.getByLabelText('次のカード'))
    // 連打対策のデバウンスをまたぐ
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    fireEvent.click(screen.getByLabelText('次のカード'))
    expect(screen.getByText('ぜんぶ できました！')).toBeDefined()
    vi.restoreAllMocks()
  })

  it('★を付けて終わると復習の案内が出る', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog'])} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: '☆ もういちど', pressed: false }))
    fireEvent.click(screen.getByLabelText('次のカード'))
    expect(screen.getByRole('button', { name: 'のカードだけ もういちど' })).toBeDefined()
    expect(screen.getByText(/もういちど れんしゅう するカード/)).toBeDefined()
  })

  it('小学校モードでは英単語を表示しない', () => {
    render(
      <FlashcardsGame set={makeSet({ mode: 'elementary' })} items={makeItems(['dog'])} {...baseProps} />,
    )
    expect(screen.queryByText('dog')).toBeNull()
  })

  it('小学校モードは旧「正解時のみ表示」が残っていても単語を出さない', () => {
    render(
      <FlashcardsGame
        set={makeSet({ mode: 'elementary', show_word_on_answer: true })}
        items={makeItems(['dog'])} {...baseProps}
      />,
    )
    expect(screen.queryByText('dog')).toBeNull()
    expect(screen.queryByText('こたえを みる')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '☆ もういちど', pressed: false }))
    fireEvent.click(screen.getByLabelText('次のカード'))
    expect(screen.queryByText('dog')).toBeNull()
  })

  it('表裏モードでは、めくるまで裏の内容が出ない', () => {
    render(
      <FlashcardsGame
        set={makeSet({ default_display: 'front_image_back_word' })}
        items={makeItems(['dog'])} {...baseProps}
      />,
    )
    expect(screen.queryByText('dog')).toBeNull()
    fireEvent.click(screen.getByText('うらを みる'))
    expect(screen.getByText('dog')).toBeDefined()
  })

  it('音声がオフのセットでは🔊ボタンを出さない', () => {
    render(<FlashcardsGame set={makeSet({ audio_enabled: false })} items={makeItems(['dog'])} {...baseProps} />)
    expect(screen.queryByLabelText('音を鳴らす')).toBeNull()
  })

  it('音声ファイルのないカードは端末の読み上げで代用する', () => {
    render(<FlashcardsGame set={makeSet({ audio_enabled: true })} items={makeItems(['dog'])} {...baseProps} />)
    fireEvent.click(screen.getByLabelText('音を鳴らす'))
    expect(speakMock).toHaveBeenCalledWith('dog', expect.anything())
  })

  it('矢印キーでカードを送れる', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat'])} {...baseProps} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('cat')).toBeDefined()
  })

  it('連打してもカードが飛ばない', () => {
    render(<FlashcardsGame set={makeSet()} items={makeItems(['a', 'b', 'c', 'd'])} {...baseProps} />)
    const next = screen.getByLabelText('次のカード')
    fireEvent.click(next); fireEvent.click(next); fireEvent.click(next)
    expect(screen.getByText('2／4')).toBeDefined() // 1枚しか進まない
  })

  it('カードが0枚でも落ちない', () => {
    render(<FlashcardsGame set={makeSet()} items={[]} {...baseProps} />)
    expect(screen.getByText(/表示できるカードがありません/)).toBeDefined()
  })
  it('中央タップは表裏モードでも次へ進み、連打しても戻らない', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    render(<FlashcardsGame set={makeSet({ default_display: 'front_image_back_word' })} items={makeItems(['dog', 'cat', 'bird'])} {...baseProps} />)
    const card = screen.getByRole('button', { name: /カード。中央/ })
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect)
    const tap = (x: number) => { fireEvent.pointerDown(card, { clientX: x, clientY: 100 }); fireEvent.pointerUp(card, { clientX: x, clientY: 100 }) }
    tap(500); tap(500); tap(500)
    expect(screen.getByText('2／3')).toBeDefined()
    expect(screen.queryByText('cat')).toBeNull()
    fireEvent.click(screen.getByText('うらを みる')); expect(screen.getByText('cat')).toBeDefined()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000)
    tap(10); expect(screen.getByText('1／3')).toBeDefined()
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  })
  it('やめるの確認中は自動送りとキー操作を止め、キャンセルで続けられる', () => {
    vi.useFakeTimers()
    const exit = vi.fn()
    render(<FlashcardsGame set={makeSet()} items={makeItems(['dog', 'cat'])} {...baseProps} onExit={exit} settings={{ ...baseProps.settings, advance: 'auto', autoSeconds: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'ゲームをやめる' }))
    act(() => vi.advanceTimersByTime(5000)); fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('dog')).toBeDefined(); expect(exit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ゲームをつづける' }))
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText('cat')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'ゲームをやめる' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ゲームをやめる' }))
    expect(exit).toHaveBeenCalledOnce()
    cleanup(); vi.useRealTimers()
  })
  it('教室用は12vhを基準にし、退出と音声を下部へ集約する', () => {
    render(<FlashcardsGame teacher set={makeSet({ audio_enabled: true })} items={makeItems(['dog'])} {...baseProps} settings={{ ...baseProps.settings, screenMode: 'classroom' }} />)
    expect(screen.getByText('dog').style.fontSize).toBe(`${window.innerHeight * 0.12}px`)
    expect(screen.getByRole('button', { name: 'ゲームをやめる' }).closest('footer')).not.toBeNull()
    expect(screen.getByRole('button', { name: '音を消す' }).closest('footer')).not.toBeNull()
  })

})
