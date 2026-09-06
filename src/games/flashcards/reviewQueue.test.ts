import { describe, expect, it } from 'vitest'
import {
  buildLap,
  createStates,
  hasRemainingReview,
  MIN_GAP,
  reviewIds,
  reviewQuota,
  spaceOut,
  toggleReview,
  type Rng,
} from './reviewQueue'

/** 決まった順に値を返す擬似乱数。テストの結果を固定するために使う */
function seeded(seed = 1): Rng {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`)

/** 同じカードが MIN_GAP 以内に再登場していないか */
function minGapOk(queue: string[]): boolean {
  for (let i = 1; i < queue.length; i++) {
    if (queue.slice(Math.max(0, i - MIN_GAP), i).includes(queue[i])) return false
  }
  return true
}

describe('toggleReview', () => {
  it('★を付けると missStreak が増える', () => {
    let s = createStates(['a'])
    s = toggleReview(s, 'a')
    expect(s.get('a')!.review).toBe(true)
    expect(s.get('a')!.missStreak).toBe(1)
    s = toggleReview(s, 'a', false)
    s = toggleReview(s, 'a', true)
    expect(s.get('a')!.missStreak).toBe(1) // 外したときにゼロへ戻る
  })

  it('★を外すと missStreak がゼロに戻る', () => {
    let s = createStates(['a'])
    s = toggleReview(s, 'a', true)
    s = toggleReview(s, 'a', true)
    expect(s.get('a')!.missStreak).toBe(2)
    s = toggleReview(s, 'a', false)
    expect(s.get('a')!.review).toBe(false)
    expect(s.get('a')!.missStreak).toBe(0)
  })

  it('元のMapを壊さない', () => {
    const s = createStates(['a'])
    toggleReview(s, 'a', true)
    expect(s.get('a')!.review).toBe(false)
  })
})

describe('reviewQuota', () => {
  it('セット枚数の50%が上限', () => {
    expect(reviewQuota(20)).toBe(10)
    expect(reviewQuota(11)).toBe(5)
    expect(reviewQuota(1)).toBe(0)
  })
})

describe('spaceOut', () => {
  it('隣接した重複を離す', () => {
    const q = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'e', 'f', 'g']
    expect(minGapOk(spaceOut(q, seeded(7)))).toBe(true)
  })

  it('要素の集合は変わらない', () => {
    const q = ['a', 'a', 'b', 'c', 'd', 'e']
    const out = spaceOut(q, seeded(3))
    expect([...out].sort()).toEqual([...q].sort())
  })

  it('短すぎて解消できない場合も落ちない', () => {
    expect(() => spaceOut(['a', 'a'], seeded(1))).not.toThrow()
  })
})

describe('buildLap — mixed（混ぜる方式）', () => {
  const cardIds = ids(10)

  it('1周目は全カードだけ', () => {
    const q = buildLap({
      cardIds,
      states: createStates(cardIds),
      mode: 'mixed',
      order: 'sequential',
      lapIndex: 0,
    })
    expect(q).toEqual(cardIds)
  })

  it('2周目は★カードが1枚ずつ増える', () => {
    let s = createStates(cardIds)
    s = toggleReview(s, 'c1', true)
    s = toggleReview(s, 'c2', true)
    const q = buildLap({
      cardIds, states: s, mode: 'mixed', order: 'random', lapIndex: 1, rng: seeded(5),
    })
    expect(q).toHaveLength(12)
    expect(q.filter((x) => x === 'c1')).toHaveLength(2)
    expect(q.filter((x) => x === 'c2')).toHaveLength(2)
    expect(q.filter((x) => x === 'c3')).toHaveLength(1)
  })

  it('同じカードが3枚以内に連続しない', () => {
    let s = createStates(cardIds)
    for (const id of ['c0', 'c1', 'c2', 'c3']) s = toggleReview(s, id, true)
    for (let seed = 1; seed <= 25; seed++) {
      const q = buildLap({
        cardIds, states: s, mode: 'mixed', order: 'random', lapIndex: 1, rng: seeded(seed),
      })
      expect(minGapOk(q)).toBe(true)
    }
  })

  it('★が多すぎても追加は50%まで', () => {
    let s = createStates(cardIds)
    for (const id of cardIds) s = toggleReview(s, id, true)
    const q = buildLap({
      cardIds, states: s, mode: 'mixed', order: 'random', lapIndex: 1, rng: seeded(9),
    })
    expect(q).toHaveLength(15) // 10 + 上限5
  })

  it('上限を超えるときは間違えた回数が多い順に選ばれる', () => {
    let s = createStates(cardIds)
    for (const id of cardIds) s = toggleReview(s, id, true)
    // c7,c8,c9 をさらに2回ずつ間違えたことにする
    for (const id of ['c7', 'c8', 'c9']) {
      s = toggleReview(s, id, true)
      s = toggleReview(s, id, true)
    }
    const q = buildLap({
      cardIds, states: s, mode: 'mixed', order: 'random', lapIndex: 1, rng: seeded(11),
    })
    for (const id of ['c7', 'c8', 'c9']) {
      expect(q.filter((x) => x === id)).toHaveLength(2)
    }
  })

  it('★を外すと次の周から追加分が消える', () => {
    let s = createStates(cardIds)
    s = toggleReview(s, 'c1', true)
    expect(
      buildLap({ cardIds, states: s, mode: 'mixed', order: 'sequential', lapIndex: 1, rng: seeded(2) }),
    ).toHaveLength(11)
    s = toggleReview(s, 'c1', false)
    expect(
      buildLap({ cardIds, states: s, mode: 'mixed', order: 'sequential', lapIndex: 1, rng: seeded(2) }),
    ).toHaveLength(10)
  })
})

describe('buildLap — rounds（まとめ方式）', () => {
  const cardIds = ids(8)

  it('1周目は全カードを設定順で出す', () => {
    const q = buildLap({
      cardIds, states: createStates(cardIds), mode: 'rounds', order: 'sequential', lapIndex: 0,
    })
    expect(q).toEqual(cardIds)
  })

  it('2周目は★カードだけ', () => {
    let s = createStates(cardIds)
    s = toggleReview(s, 'c2', true)
    s = toggleReview(s, 'c5', true)
    const q = buildLap({
      cardIds, states: s, mode: 'rounds', order: 'sequential', lapIndex: 1, rng: seeded(4),
    })
    expect([...q].sort()).toEqual(['c2', 'c5'])
  })

  it('★がゼロになれば次の周は空', () => {
    const s = createStates(cardIds)
    expect(
      buildLap({ cardIds, states: s, mode: 'rounds', order: 'sequential', lapIndex: 1, rng: seeded(4) }),
    ).toEqual([])
    expect(hasRemainingReview(s)).toBe(false)
  })
})

describe('境界', () => {
  it('カードが無ければ空を返す', () => {
    expect(
      buildLap({ cardIds: [], states: createStates([]), mode: 'mixed', order: 'random', lapIndex: 1 }),
    ).toEqual([])
  })

  it('1枚だけでも落ちない', () => {
    let s = createStates(['a'])
    s = toggleReview(s, 'a', true)
    const q = buildLap({ cardIds: ['a'], states: s, mode: 'mixed', order: 'random', lapIndex: 1, rng: seeded(1) })
    expect(q.length).toBeGreaterThanOrEqual(1)
  })

  it('reviewIds は★の付いたものだけ返す', () => {
    let s = createStates(['a', 'b', 'c'])
    s = toggleReview(s, 'b', true)
    expect(reviewIds(s)).toEqual(['b'])
  })
})
