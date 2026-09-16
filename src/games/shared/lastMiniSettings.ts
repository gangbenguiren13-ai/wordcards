import type { MaterialSet, MemoryDefaults, SlowRevealDefaults } from '@/types'
import { memorySettings, revealSettings, type MiniGame } from './miniGames'

const key = (set: MaterialSet, game: MiniGame) => `wordcards.last.${set.owner_id}.${set.id}.${game}`
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
function read(set: MaterialSet, game: MiniGame): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(set, game)) ?? '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch { return {} }
}
export function lastMemorySettings(set: MaterialSet): MemoryDefaults {
  const base = memorySettings(set), s = read(set, 'memory')
  if (![8, 12, 16, 20].includes(s.cardCount as number) || !['sequential', 'random'].includes(String(s.pick))
    || !['word_image', 'word_word', 'image_image', 'image_pairimage'].includes(String(s.pairType))
    || !(s.timeLimitMinutes === null || integer(s.timeLimitMinutes, 1, 10)) || !integer(s.teams, 1, 4) || typeof s.audioOnMatch !== 'boolean') return base
  const saved = s as unknown as MemoryDefaults
  return { ...base, ...saved, pairType: set.mode === 'elementary' && saved.pairType.startsWith('word') ? 'image_image' : saved.pairType }
}
export function lastRevealSettings(set: MaterialSet): SlowRevealDefaults {
  const base = revealSettings(set), s = read(set, 'slowreveal')
  if (!['top', 'bottom', 'left', 'right', 'center'].includes(String(s.direction)) || !integer(s.steps, 4, 12)
    || !['manual', 'auto'].includes(String(s.advance)) || !integer(s.autoSeconds, 1, 10)
    || !['sequential', 'random'].includes(String(s.order)) || !['image', 'image_word', 'image_word_audio'].includes(String(s.answerDisplay))) return base
  return { ...base, ...s, answerDisplay: set.mode === 'elementary' ? 'image' : s.answerDisplay as SlowRevealDefaults['answerDisplay'] }
}
export function rememberMiniSettings(set: MaterialSet, game: MiniGame, settings: MemoryDefaults | SlowRevealDefaults) {
  try { localStorage.setItem(key(set, game), JSON.stringify(settings)) } catch { /* unavailable storage must not block play */ }
}
