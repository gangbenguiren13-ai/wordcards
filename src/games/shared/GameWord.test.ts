import { expect, it } from 'vitest'
import { fitWordSize } from './GameWord'
it('普通の語は基準サイズのまま、長い固有名詞だけ横幅へ縮小する', () => {
  expect(fitWordSize(120, 900, 300)).toBe(120)
  expect(fitWordSize(120, 900, 1800)).toBe(60)
})
