import type { Card, MaterialSet, MemoryDefaults, SlowRevealDefaults } from '@/types'
import { memoryDefaults, slowRevealDefaults, FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import { selectUsableCards } from '@/lib/usableCards'
import { effectiveDisplay } from '@/games/flashcards/settings'

export type MiniGame = 'memory' | 'slowreveal'
export const STUDENT_GAME_NAMES = { flashcards: 'フラッシュカード', memory: 'しんけいすいじゃく', slowreveal: 'ゆっくりみえるゲーム' }
export const GAME_NAMES = { flashcards: 'フラッシュカード', memory: '神経衰弱', slowreveal: 'Slow Reveal' }
export function shuffled<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
export function memorySettings(set: MaterialSet): MemoryDefaults {
  const s = { ...memoryDefaults(set.mode), ...set.games_config.memory?.defaults }
  if (set.mode === 'elementary' && (s.pairType === 'word_image' || s.pairType === 'word_word')) s.pairType = 'image_image'
  return s
}
export function revealSettings(set: MaterialSet): SlowRevealDefaults {
  const s = { ...slowRevealDefaults(set.mode), ...set.games_config.slowreveal?.defaults }
  if (set.mode === 'elementary') s.answerDisplay = 'image'
  return s
}
export function memoryCards(cards: Card[], settings: MemoryDefaults): Card[] {
  return cards.filter(c => {
    if (settings.pairType === 'word_word') return Boolean(c.word.trim())
    if (!c.image_path) return false
    if (settings.pairType === 'word_image') return Boolean(c.word.trim())
    return settings.pairType !== 'image_pairimage' || Boolean(c.pair_image_path)
  })
}
export function pickMemoryCards(cards: Card[], settings: MemoryDefaults): Card[] {
  const usable = memoryCards(cards, settings)
  return (settings.pick === 'random' ? shuffled(usable) : usable).slice(0, settings.cardCount / 2)
}
export function canShareGame(set: MaterialSet, cards: Card[]): boolean {
  return Boolean((set.games_config.flashcards?.enabledForStudents && selectUsableCards(cards,
    effectiveDisplay(set, { ...FLASHCARDS_DEFAULTS, ...set.games_config.flashcards.defaults })).usable.length)
    || (set.games_config.memory?.enabledForStudents && memoryCards(cards, memorySettings(set)).length >= 4)
    || (set.games_config.slowreveal?.enabledForStudents && cards.some(c => c.image_path)))
}
