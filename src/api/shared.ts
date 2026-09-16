import { functionUrl } from '@/lib/supabase'
import type { Card, MaterialSet } from '@/types'

export const SHARE_TOKEN = /^[A-Za-z0-9_-]{21}$/

export interface SharedPayload {
  set: {
    title: string
    mode: MaterialSet['mode']
    defaultDisplay: MaterialSet['default_display']
    audioEnabled: boolean
    showWordOnAnswer: boolean
    gamesConfig: MaterialSet['games_config']
  }
  cards: {
    id: string; word: string; imageUrl: string | null
    pairImageUrl: string | null; audioUrl: string | null; sortOrder: number
  }[]
}

export class SharedError extends Error {
  readonly code: 'NOT_FOUND' | 'NETWORK' | 'BUSY'
  constructor(public status: number) {
    super(status === 404 ? 'このQRコードは つかえません。先生に みせてください。'
      : status === 429 ? 'アクセスが こんでいます。少しまってから もういちど。'
        : 'よみこめませんでした。通信を たしかめて、もういちど。')
    this.code = status === 404 ? 'NOT_FOUND' : status === 429 ? 'BUSY' : 'NETWORK'
  }
}

/** 教師のログイン状態に依存せず、共有窓口だけにアクセスする。 */
export async function fetchSharedSet(token: string): Promise<SharedPayload> {
  if (!SHARE_TOKEN.test(token)) throw new SharedError(404)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${functionUrl('shared-set')}?token=${encodeURIComponent(token)}`, {
      signal: controller.signal, cache: 'no-store', credentials: 'omit',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '' },
    })
    if (!response.ok) throw new SharedError(response.status)
    const payload = await response.json() as SharedPayload
    if (!payload.set || !Array.isArray(payload.cards)) throw new SharedError(503)
    return payload
  } catch (error) {
    if (error instanceof SharedError) throw error
    throw new SharedError(503)
  } finally { clearTimeout(timer) }
}

/** 共通ゲーム向けのメモリ内データ。教師IDやDBのパスは必要としない。 */
export function sharedGameData(payload: SharedPayload) {
  const set: MaterialSet = {
    id: 'shared', owner_id: '', title: payload.set.title, mode: payload.set.mode,
    default_display: payload.set.defaultDisplay, audio_enabled: payload.set.audioEnabled,
    show_word_on_answer: payload.set.showWordOnAnswer, games_config: payload.set.gamesConfig,
    share_token: null, share_enabled: true, school_shared: false,
    created_at: '', updated_at: '', deleted_at: null,
  }
  const urls: Record<string, string> = {}
  const cards: Card[] = payload.cards.map((card) => {
    const mediaKey = (kind: string, url: string | null) => {
      if (!url) return null
      const key = `${card.id}/${kind}`
      urls[key] = url
      return key
    }
    return {
      id: card.id, set_id: 'shared', word: card.word,
      image_path: mediaKey('image', card.imageUrl),
      pair_image_path: mediaKey('pair', card.pairImageUrl),
      audio_path: mediaKey('audio', card.audioUrl), audio_source: null,
      sort_order: card.sortOrder, created_at: '', updated_at: '',
    }
  })
  return { set, cards, urls }
}
