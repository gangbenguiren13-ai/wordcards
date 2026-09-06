import { supabase } from '@/lib/supabase'
import * as media from '@/lib/mediaStore'
import { compressImage } from '@/lib/imageCompress'
import type { Card } from '@/types'

export async function createCard(setId: string, word: string, sortOrder: number) {
  const { data, error } = await supabase
    .from('cards')
    .insert({ set_id: setId, word, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data as Card
}

export async function updateCard(
  id: string,
  patch: Partial<
    Pick<Card, 'word' | 'image_path' | 'pair_image_path' | 'audio_path' | 'audio_source' | 'sort_order'>
  >,
) {
  const { error } = await supabase.from('cards').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCard(card: Card): Promise<void> {
  const paths = [card.image_path, card.pair_image_path, card.audio_path].filter(
    (p): p is string => Boolean(p),
  )
  // 先にDB行を消す（Storage削除の失敗で操作全体が止まらないようにする）
  const { error } = await supabase.from('cards').delete().eq('id', card.id)
  if (error) throw error
  if (paths.length > 0) {
    try {
      await media.removeMedia(paths)
    } catch (e) {
      console.warn('メディアの削除に失敗しました（データ自体は削除済み）', e)
    }
  }
}

/** 並べ替えの結果をまとめて保存する */
export async function reorderCards(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('cards').update({ sort_order: index }).eq('id', id),
    ),
  )
}

/** 画像を圧縮してアップロードし、カードに紐づける */
export async function attachImage(
  ownerId: string,
  card: Card,
  file: File,
  kind: 'image' | 'pair' = 'image',
): Promise<{ path: string; originalBytes: number; storedBytes: number }> {
  const result = await compressImage(file)
  const path = await media.uploadImage(ownerId, card.set_id, card.id, kind, result.blob)
  await updateCard(card.id, kind === 'image' ? { image_path: path } : { pair_image_path: path })
  return { path, originalBytes: result.originalBytes, storedBytes: result.blob.size }
}

/** 音声をアップロードしてカードに紐づける（変換はしない） */
export async function attachAudio(
  ownerId: string,
  card: Card,
  file: File,
): Promise<string> {
  const path = await media.uploadAudio(ownerId, card.set_id, card.id, file)
  await updateCard(card.id, { audio_path: path, audio_source: 'upload' })
  return path
}

/** メディアを外す（ファイルも削除する） */
export async function detachMedia(
  card: Card,
  kind: 'image' | 'pair' | 'audio',
): Promise<void> {
  const path =
    kind === 'image' ? card.image_path : kind === 'pair' ? card.pair_image_path : card.audio_path
  if (!path) return
  await updateCard(
    card.id,
    kind === 'audio'
      ? { audio_path: null, audio_source: null }
      : { [kind === 'image' ? 'image_path' : 'pair_image_path']: null },
  )
  try {
    await media.removeMedia([path])
  } catch (e) {
    console.warn('ファイルの削除に失敗しました', e)
  }
}
