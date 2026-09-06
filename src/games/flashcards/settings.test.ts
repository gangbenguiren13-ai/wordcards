import { describe, expect, it } from 'vitest'
import { effectiveDisplay, isTwoSided } from './settings'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import type { MaterialSet } from '@/types'

function set(over: Partial<MaterialSet>): MaterialSet {
  return {
    id: 's', owner_id: 'o', title: 't',
    mode: over.mode ?? 'junior',
    default_display: over.default_display ?? 'word_image',
    audio_enabled: false, show_word_on_answer: false,
    games_config: {}, share_token: null, share_enabled: false, school_shared: false,
    created_at: '', updated_at: '', deleted_at: null,
  }
}

describe('effectiveDisplay', () => {
  it('小学校モードは設定によらず画像のみになる', () => {
    for (const d of ['word_image', 'word_only', 'front_word_back_image'] as const) {
      expect(
        effectiveDisplay(set({ mode: 'elementary' }), { ...FLASHCARDS_DEFAULTS, display: d }),
      ).toBe('image_only')
    }
  })

  it('中学校モードは設定を尊重する', () => {
    expect(
      effectiveDisplay(set({ mode: 'junior' }), { ...FLASHCARDS_DEFAULTS, display: 'word_only' }),
    ).toBe('word_only')
  })

  it('設定が未指定ならセットの既定値を使う', () => {
    expect(
      effectiveDisplay(set({ mode: 'junior', default_display: 'image_only' }), {
        ...FLASHCARDS_DEFAULTS, display: null,
      }),
    ).toBe('image_only')
  })
})

describe('isTwoSided', () => {
  it('表裏モードだけ true', () => {
    expect(isTwoSided('front_image_back_word')).toBe(true)
    expect(isTwoSided('front_word_back_image')).toBe(true)
    expect(isTwoSided('word_image')).toBe(false)
    expect(isTwoSided('image_only')).toBe(false)
  })
})
