// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { lastMemorySettings, lastRevealSettings, rememberMiniSettings } from './lastMiniSettings'
import { memorySettings, revealSettings } from './miniGames'
import type { MaterialSet } from '@/types'
const set = { id: 's', owner_id: 't', mode: 'junior', games_config: {} } as MaterialSet
beforeEach(() => localStorage.clear())
it('前回遊んだ設定を教材ごとに復元し、生徒の公開設定には書き込まない', () => {
  rememberMiniSettings(set, 'memory', { ...memorySettings(set), cardCount: 8, teams: 3 })
  expect(lastMemorySettings(set).teams).toBe(3)
  expect(lastMemorySettings({ ...set, id: 'other' })).toEqual(memorySettings(set))
  expect(set.games_config).toEqual({})
})
it('破損データは既定値に戻し、小学校へ切り替えた場合も英単語を出さない', () => {
  rememberMiniSettings(set, 'memory', { ...memorySettings(set), pairType: 'word_word' })
  rememberMiniSettings(set, 'slowreveal', { ...revealSettings(set), answerDisplay: 'image_word_audio' })
  expect(lastMemorySettings({ ...set, mode: 'elementary' }).pairType).toBe('image_image')
  expect(lastRevealSettings({ ...set, mode: 'elementary' }).answerDisplay).toBe('image')
  localStorage.setItem('wordcards.last.t.s.memory', '{broken')
  expect(lastMemorySettings(set)).toEqual(memorySettings(set))
})
