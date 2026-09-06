import type { Card } from '@/types'

/**
 * ゲーム開始時に画像と音声をまとめて取り込む。
 *
 * 授業中に通信が切れても続けられるようにするのが第一の目的。
 * 署名付きURLの期限切れやカード送りのたびの遅延も、これで同時に避けられる。
 */

export interface PreloadedCard {
  card: Card
  imageUrl: string | null
  audio: ArrayBuffer | null
}

export interface PreloadProgress {
  done: number
  total: number
}

export interface PreloadResult {
  items: PreloadedCard[]
  /** 取り込めなかったカード。表示はするが音や画像が出ない */
  failures: { cardId: string; reason: string }[]
}

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param signedUrls パス → 署名付きURL の対応表
 * @param onProgress 進捗表示のためのコールバック
 */
export async function preloadCards(
  cards: Card[],
  signedUrls: Record<string, string>,
  onProgress?: (p: PreloadProgress) => void,
): Promise<PreloadResult> {
  const total = cards.length
  let done = 0
  const failures: PreloadResult['failures'] = []

  const items = await Promise.all(
    cards.map(async (card): Promise<PreloadedCard> => {
      let imageUrl: string | null = null
      let audio: ArrayBuffer | null = null

      try {
        const imgSrc = card.image_path ? signedUrls[card.image_path] : null
        if (card.image_path && !imgSrc) {
          failures.push({ cardId: card.id, reason: '画像URLを取得できませんでした' })
        }
        if (imgSrc) {
          const res = await fetchWithTimeout(imgSrc)
          if (res.ok) imageUrl = URL.createObjectURL(await res.blob())
          else failures.push({ cardId: card.id, reason: `画像 ${res.status}` })
        }
      } catch (e) {
        failures.push({ cardId: card.id, reason: `画像 ${(e as Error).name}` })
      }

      try {
        const audioSrc = card.audio_path ? signedUrls[card.audio_path] : null
        if (card.audio_path && !audioSrc) {
          failures.push({ cardId: card.id, reason: '音声URLを取得できませんでした' })
        }
        if (audioSrc) {
          const res = await fetchWithTimeout(audioSrc)
          if (res.ok) audio = await res.arrayBuffer()
          else failures.push({ cardId: card.id, reason: `音声 ${res.status}` })
        }
      } catch (e) {
        failures.push({ cardId: card.id, reason: `音声 ${(e as Error).name}` })
      }

      done++
      onProgress?.({ done, total })
      return { card, imageUrl, audio }
    }),
  )

  return { items, failures }
}

/** 取り込んだ画像のURLを解放する。ゲームを抜けるときに呼ぶ */
export function releasePreloaded(items: PreloadedCard[]): void {
  for (const item of items) {
    if (item.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(item.imageUrl)
  }
}
