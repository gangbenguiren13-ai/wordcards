import type {
  FlashcardsDefaults,
  GamesConfig,
  MemoryDefaults,
  SetMode,
  SlowRevealDefaults,
} from '@/types'
import { SLOWREVEAL_STEPS_DEFAULT } from './constants'

export const FLASHCARDS_DEFAULTS: FlashcardsDefaults = {
  order: 'sequential',
  advance: 'manual',
  autoSeconds: 3,
  display: null, // null = セットの default_display を使う
  showProgress: true,
  audioAutoplay: false,
  reviewMode: 'mixed',
}

export function memoryDefaults(mode: SetMode): MemoryDefaults {
  return {
    cardCount: 12,
    pick: 'random',
    // 小学校は文字なしで成立する方式を既定にする
    pairType: mode === 'elementary' ? 'image_image' : 'word_image',
    timeLimitMinutes: null,
    teams: 1,
    audioOnMatch: true,
  }
}

export function slowRevealDefaults(mode: SetMode): SlowRevealDefaults {
  return {
    direction: 'top',
    steps: SLOWREVEAL_STEPS_DEFAULT,
    advance: 'manual',
    autoSeconds: 3,
    order: 'random',
    answerDisplay: mode === 'elementary' ? 'image' : 'image_word',
  }
}

/** 新規セット作成時の games_config */
export function defaultGamesConfig(mode: SetMode): GamesConfig {
  return {
    flashcards: {
      enabledForStudents: true,
      defaults: { ...FLASHCARDS_DEFAULTS },
      studentAdjustable: ['order', 'advance'],
    },
    memory: {
      enabledForStudents: true,
      defaults: memoryDefaults(mode),
      studentAdjustable: ['cardCount'],
    },
    slowreveal: {
      enabledForStudents: false, // 既定では教師の一斉提示用
      defaults: slowRevealDefaults(mode),
      studentAdjustable: [],
    },
  }
}
