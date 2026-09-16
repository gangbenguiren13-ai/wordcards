import type { DisplayMode, FlashcardsDefaults, MaterialSet } from '@/types'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'

export type FlashcardsSettings = FlashcardsDefaults & { screenMode?: 'handheld' | 'classroom' }

const KEY = 'wordcards.flashcards.settings'

/**
 * 設定はセットの既定値を土台に、その端末で前回使った値を上書きする。
 * 同じ先生が同じ端末で続けて使うことが多いので、毎回選び直させない。
 */
export function initialSettings(set: MaterialSet): FlashcardsSettings {
  const base: FlashcardsSettings = {
    ...FLASHCARDS_DEFAULTS,
    ...(set.games_config.flashcards?.defaults ?? {}),
  }
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FlashcardsSettings>
      return { ...base, ...parsed, screenMode: parsed.screenMode === 'classroom' ? 'classroom' : 'handheld' }
    }
  } catch {
    /* 保存できない環境では既定値のまま進む */
  }
  return base
}

export function rememberSettings(s: FlashcardsSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* noop */
  }
}

/**
 * 実際に使う表示方法を決める。
 *
 * 小学校モードは「生徒に文字を見せない」ことが要件なので、
 * 設定に何が入っていても画像のみに倒す。ここを設定任せにすると、
 * 前回の中学校での設定が残っていて小学生に英単語が出る、という事故が起きる。
 */
export function effectiveDisplay(set: MaterialSet, s: FlashcardsSettings): DisplayMode {
  if (set.mode === 'elementary') return 'image_only'
  return s.display ?? set.default_display
}

/** 表裏のあるモードかどうか */
export function isTwoSided(display: DisplayMode): boolean {
  return display === 'front_image_back_word' || display === 'front_word_back_image'
}
