import { supabase } from './supabase'
import { SIGNED_URL_TTL_SEC } from './constants'
import { extOf } from './normalize'

/**
 * メディア（画像・音声）の保存先を抽象化する層。
 *
 * 将来、転送量が Supabase の無料枠を超えた場合は、このモジュールだけを
 * Cloudflare R2 版に差し替えれば移行できる（計画書 13-2）。
 * 呼び出し側は Storage の実体を知らないこと。
 */

export const MEDIA_BUCKET = 'media'

export type MediaKind = 'image' | 'pair' | 'audio'

/** パス規約: {owner_id}/{set_id}/{card_id}/{kind}.{ext} */
export function mediaPath(
  ownerId: string,
  setId: string,
  cardId: string,
  kind: MediaKind,
  ext: string,
): string {
  return `${ownerId}/${setId}/${cardId}/${kind}.${ext}`
}

export function setFolder(ownerId: string, setId: string): string {
  return `${ownerId}/${setId}`
}

/** 圧縮済み画像をアップロードして保存パスを返す */
export async function uploadImage(
  ownerId: string,
  setId: string,
  cardId: string,
  kind: 'image' | 'pair',
  blob: Blob,
): Promise<string> {
  const path = mediaPath(ownerId, setId, cardId, kind, 'webp')
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true })
  if (error) throw error
  return path
}

/** 音声をアップロードして保存パスを返す（変換はしない） */
export async function uploadAudio(
  ownerId: string,
  setId: string,
  cardId: string,
  file: File,
): Promise<string> {
  const ext = extOf(file.name) || 'mp3'
  const path = mediaPath(ownerId, setId, cardId, 'audio', ext)
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: true })
  if (error) throw error
  return path
}

/** 1件の署名付きURLを発行する */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (error) throw error
  return data.signedUrl
}

/** 複数パスの署名付きURLをまとめて発行する（path -> url） */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}

/** 指定パスを削除する（存在しなくてもエラーにしない） */
export async function removeMedia(paths: string[]): Promise<void> {
  const targets = paths.filter(Boolean)
  if (targets.length === 0) return
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(targets)
  if (error) throw error
}

/**
 * セット複製用。フォルダ配下を新しい set_id / card_id 配下へ物理コピーする。
 * 参照の共有はしない（片方の削除でもう片方が壊れるのを避けるため）。
 */
export async function copyMedia(fromPath: string, toPath: string): Promise<void> {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).copy(fromPath, toPath)
  if (error) throw error
}

/** セット配下のファイルを列挙する（削除・複製の対象洗い出しに使う） */
export async function listSetMedia(ownerId: string, setId: string): Promise<string[]> {
  const prefix = setFolder(ownerId, setId)
  const { data: cardDirs, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(prefix, { limit: 1000 })
  if (error) throw error

  const results: string[] = []
  for (const dir of cardDirs ?? []) {
    // ファイルではなくカードIDのフォルダが並ぶ
    const { data: files } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(`${prefix}/${dir.name}`, { limit: 100 })
    for (const f of files ?? []) {
      results.push(`${prefix}/${dir.name}/${f.name}`)
    }
  }
  return results
}
