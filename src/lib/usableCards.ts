import type { Card, DisplayMode } from '@/types'

/**
 * その表示方法で実際に出題できるカードだけを残す。
 *
 * 教材づくりの途中では、画像だけ入れて単語が空、あるいはその逆のカードが必ず出る。
 * それを黙って表示すると、授業中に空白のカードが出てきて場が止まる。
 * ここで先に外し、「N枚は使われません」と開始前に伝えることで、
 * 教師が気づかないまま授業に持ち込むのを防ぐ。
 */
export function needsWord(display: DisplayMode): boolean {
  return display !== 'image_only'
}

export function needsImage(display: DisplayMode): boolean {
  return display !== 'word_only'
}

export interface UsableResult {
  usable: Card[]
  excluded: Card[]
  /** 生徒・教師に見せる説明。除外がなければ null */
  reason: string | null
}

export function selectUsableCards(cards: Card[], display: DisplayMode): UsableResult {
  const wantWord = needsWord(display)
  const wantImage = needsImage(display)

  const usable: Card[] = []
  const excluded: Card[] = []

  for (const card of cards) {
    const hasWord = card.word.trim().length > 0
    const hasImage = Boolean(card.image_path)
    if ((wantWord && !hasWord) || (wantImage && !hasImage)) {
      excluded.push(card)
    } else {
      usable.push(card)
    }
  }

  let reason: string | null = null
  if (excluded.length > 0) {
    const missingImage = excluded.filter((c) => !c.image_path).length
    const missingWord = excluded.filter((c) => !c.word.trim()).length
    const parts: string[] = []
    if (wantImage && missingImage > 0) parts.push(`画像がない${missingImage}枚`)
    if (wantWord && missingWord > 0) parts.push(`単語がない${missingWord}枚`)
    reason = `${parts.join('と')}は、この見せ方では使えないため飛ばします`
  }

  return { usable, excluded, reason }
}
