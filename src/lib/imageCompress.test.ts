import { describe, expect, it } from 'vitest'
import { fitWithin } from './imageCompress'

describe('fitWithin', () => {
  it('長辺を上限に合わせて縮小する（横長）', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
  })

  it('長辺を上限に合わせて縮小する（縦長）', () => {
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 })
  })

  it('小さい画像は拡大しない', () => {
    expect(fitWithin(400, 300, 1200)).toEqual({ width: 400, height: 300 })
  })

  it('正方形も比率を保つ', () => {
    expect(fitWithin(2400, 2400, 1200)).toEqual({ width: 1200, height: 1200 })
  })
})
