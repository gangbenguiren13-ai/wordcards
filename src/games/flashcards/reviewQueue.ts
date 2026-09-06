/**
 * 要復習カードの再出題ロジック。
 *
 * 授業で「言えなかったカード」をその場で★指定し、同じ回の中でもう一度出す仕組み。
 * 生徒名や成績は一切保存せず、状態はこの実行中のメモリにだけ置く。
 *
 * 方式が2つあるのは、教室の使い方が2通りあるため。
 *  - mixed（混ぜる）: 通常のカードの合間に苦手カードを紛れ込ませる。テンポを保ったまま反復できる
 *  - rounds（まとめ）: 1周してから苦手カードだけをもう1周。できたものを外していく達成感が出る
 */

export interface CardState {
  cardId: string
  /** ★が付いているか */
  review: boolean
  /** 連続で言えなかった回数。混ぜる方式で、どれを優先して増やすかの順位に使う */
  missStreak: number
}

export type ReviewMode = 'mixed' | 'rounds'
export type Order = 'sequential' | 'random'

/** テストで結果を固定するために乱数を差し替えられるようにしておく */
export type Rng = () => number

export function createStates(cardIds: string[]): Map<string, CardState> {
  return new Map(cardIds.map((id) => [id, { cardId: id, review: false, missStreak: 0 }]))
}

/** ★を付ける／外す。付けるたびに missStreak が上がり、外すとゼロに戻る */
export function toggleReview(
  states: Map<string, CardState>,
  cardId: string,
  next?: boolean,
): Map<string, CardState> {
  const copy = new Map(states)
  const cur = copy.get(cardId) ?? { cardId, review: false, missStreak: 0 }
  const review = next ?? !cur.review
  copy.set(cardId, {
    cardId,
    review,
    missStreak: review ? cur.missStreak + 1 : 0,
  })
  return copy
}

export function reviewIds(states: Map<string, CardState>): string[] {
  return [...states.values()].filter((s) => s.review).map((s) => s.cardId)
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 同じカードが立て続けに出ないよう並べ直す。
 *
 * 混ぜる方式では1周に同じカードが2回出る。シャッフルしただけだと
 * 「dog, dog」と隣り合うことがあり、反復の意味が薄れるうえ生徒には
 * ミスに見える。直前3枚に同じカードがあれば、後方のどれかと入れ替える。
 * 短いセットでは解消しきれないので、試行回数で打ち切って諦める。
 */
export const MIN_GAP = 3

export function spaceOut(queue: string[], rng: Rng): string[] {
  // 残り枚数の多いカードから優先して置いていく。
  // 「直近3枚に出ていないもののうち、残りが多いもの」を毎回選ぶと、
  // 詰まりやすいカード（2回出るもの）が先に片付き、最後まで間隔を保てる。
  // 交換で直す方式は、直したそばから別の衝突を作ることがあって収束しなかった。
  const remaining = new Map<string, number>()
  for (const id of queue) remaining.set(id, (remaining.get(id) ?? 0) + 1)

  const result: string[] = []
  while (result.length < queue.length) {
    const recent = result.slice(-MIN_GAP)
    let pool = [...remaining.entries()].filter(([id, n]) => n > 0 && !recent.includes(id))

    // どれも直近に出てしまう場合は間隔の条件を緩める。
    // 短いセットでは物理的に満たせないことがあり、そこで止まるより出題を続けるほうがよい
    if (pool.length === 0) {
      const last = result.slice(-1)
      pool = [...remaining.entries()].filter(([id, n]) => n > 0 && !last.includes(id))
    }
    if (pool.length === 0) {
      pool = [...remaining.entries()].filter(([, n]) => n > 0)
    }

    const maxCount = Math.max(...pool.map(([, n]) => n))
    const best = pool.filter(([, n]) => n === maxCount)
    const [pick] = best[Math.floor(rng() * best.length)]

    result.push(pick)
    remaining.set(pick, (remaining.get(pick) ?? 1) - 1)
  }
  return result
}

export interface BuildLapInput {
  /** 出題対象のカードID（表示できないカードは呼び出し側で除外済み） */
  cardIds: string[]
  states: Map<string, CardState>
  mode: ReviewMode
  order: Order
  /** 0始まり。0が1周目 */
  lapIndex: number
  rng?: Rng
}

/**
 * 追加できる要復習カードの上限。
 * セット枚数の50%までにしているのは、苦手カードばかりが並んで
 * 1周が終わらなくなるのを防ぐため。
 */
export function reviewQuota(total: number): number {
  return Math.floor(total / 2)
}

/** その周に出題するカードIDの並びを作る */
export function buildLap({
  cardIds,
  states,
  mode,
  order,
  lapIndex,
  rng = Math.random,
}: BuildLapInput): string[] {
  if (cardIds.length === 0) return []

  const marked = cardIds.filter((id) => states.get(id)?.review)

  if (mode === 'rounds') {
    // 1周目は全部。2周目以降は★が付いたものだけを、順番を変えて出す
    if (lapIndex === 0) {
      return order === 'random' ? shuffle(cardIds, rng) : [...cardIds]
    }
    return shuffle(marked, rng)
  }

  // mixed: 全カード＋★カードをもう1枚ずつ
  const base = order === 'random' ? shuffle(cardIds, rng) : [...cardIds]
  if (lapIndex === 0 || marked.length === 0) return base

  const quota = reviewQuota(cardIds.length)
  const extras =
    marked.length <= quota
      ? marked
      : [...marked]
          .sort((a, b) => (states.get(b)?.missStreak ?? 0) - (states.get(a)?.missStreak ?? 0))
          .slice(0, quota)

  return spaceOut(shuffle([...base, ...extras], rng), rng)
}

/** その周を終えたあと、次の周が必要か */
export function hasRemainingReview(states: Map<string, CardState>): boolean {
  return reviewIds(states).length > 0
}
