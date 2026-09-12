import { supabase } from '@/lib/supabase'
import * as media from '@/lib/mediaStore'
import { compressImage } from '@/lib/imageCompress'
import { extOf } from '@/lib/normalize'
import { CARDS_HARD_LIMIT, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES } from '@/lib/constants'
import { checkUploadFile } from '@/lib/validation'
import { SLOTS, slotPath, type DraftRow } from '@/lib/bulkImport'
import { archiveManifest, MAX_ARCHIVE_BYTES, zipArchive, type ArchivePreview } from '@/lib/setArchive'
import { getCards, getSet } from './sets'
import type { Card } from '@/types'

export interface ImportJob {
  id: string; ownerId: string; setId: string; rows: DraftRow[]; archive?: ArchivePreview
  done: Set<string>; completeRows: number; started: boolean
}
export function importJob(ownerId: string, setId: string, rows: DraftRow[], archive?: ArchivePreview): ImportJob {
  return { id: crypto.randomUUID(), ownerId, setId, rows: rows.map(r => ({ ...r, files: { ...r.files } })), archive, done: new Set(), completeRows: 0, started: false }
}

/** Stable IDs and per-step checkpoints make retry safe, including a lost INSERT response. */
export async function runImport(job: ImportJob, progress: (message: string) => void): Promise<void> {
  job.started = true
  if (job.archive && !job.done.has('set')) {
    progress('新しい教材を用意しています…')
    const s = job.archive.archive.set
    const { error } = await supabase.from('material_sets').upsert({
      id: job.setId, owner_id: job.ownerId, title: s.title, mode: s.mode, default_display: s.defaultDisplay,
      audio_enabled: s.audioEnabled, show_word_on_answer: s.showWordOnAnswer, games_config: s.gamesConfig,
      share_enabled: false, share_token: null, school_shared: false,
    }, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    job.done.add('set')
  }
  const set = await getSet(job.setId)
  if (set.owner_id !== job.ownerId || set.deleted_at) throw new Error('この教材は編集できません。ホームから確認してください。')
  const current = await getCards(job.setId)
  const newRows = job.rows.filter(r => !r.existing && !current.some(c => c.id === r.id))
  if (current.length + newRows.length > CARDS_HARD_LIMIT) throw new Error('登録すると200枚を超えます。教材を分けてください。')
  for (const [index, row] of job.rows.entries()) {
    progress(`${index + 1} / ${job.rows.length}枚：${row.word || '（単語なし）'} を登録しています…`)
    let card = current.find(c => c.id === row.id)
    if (row.existing && !card) throw new Error(`「${row.word}」が別の画面で削除されました。編集画面で確認してください。`)
    if (!row.existing && !job.done.has(row.id)) {
      const { error } = await supabase.from('cards').upsert({ id: row.id, set_id: job.setId, word: row.word, sort_order: row.order }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      job.done.add(row.id)
    }
    card ??= { id: row.id, set_id: job.setId, image_path: null, pair_image_path: null, audio_path: null } as Card
    for (const slot of SLOTS) {
      const file = row.files[slot], step = `${row.id}:${slot}`
      if (!file || job.done.has(step)) continue
      const issue = checkUploadFile(file, slot === 'audio' ? 'audio' : 'image')
      if (issue) throw new Error(issue.message)
      const kind = slot === 'pairImage' ? 'pair' : slot
      const ext = slot === 'audio' ? extOf(file.name) : 'webp'
      const expectedPath = `${job.ownerId}/${job.setId}/${row.id}/${kind}-${job.id}.${ext}`
      const oldPath = slotPath(card, slot)
      if (oldPath === expectedPath) { job.done.add(step); continue } // UPDATE succeeded but response was lost
      if (row.existing && oldPath !== slotPath(row.existing, slot)) throw new Error(`「${row.word}」のファイルが別の画面で変更されました。編集画面で確認してください。`)
      let blob: Blob = file
      if (slot !== 'audio') {
        const compressed = await compressImage(file) // decodes/validates even a restored WebP
        blob = job.archive && extOf(file.name) === 'webp' ? file : compressed.blob
      }
      const path = await media.uploadImportFile(job.ownerId, job.setId, row.id, kind, job.id, blob, ext)
      const patch = slot === 'audio' ? { audio_path: path, audio_source: 'upload' } : slot === 'image' ? { image_path: path } : { pair_image_path: path }
      const { error } = await supabase.from('cards').update(patch).eq('id', row.id).eq('set_id', job.setId).select('id').single()
      if (error) throw error
      job.done.add(step)
    }
    job.completeRows = index + 1
  }
  progress(`${job.rows.length}枚の登録が完了しました。`)
}

export async function exportSet(setId: string, withMedia: boolean, progress: (message: string) => void): Promise<{ blob: Blob; name: string }> {
  const set = await getSet(setId)
  const cards = await getCards(setId)
  const manifest = archiveManifest(set, cards, withMedia)
  const json = JSON.stringify(manifest, null, 2)
  if (!withMedia) return { blob: new Blob([json], { type: 'application/json' }), name: `${set.title}.wordcards.json` }
  const files: Record<string, Uint8Array> = { 'set.json': new TextEncoder().encode(json) }
  let total = files['set.json'].length
  for (const [i, card] of cards.entries()) {
    progress(`${i + 1} / ${cards.length}枚の画像・音声を準備しています…`)
    for (const slot of SLOTS) {
      const path = slotPath(card, slot), name = manifest.set.cards[i][slot]
      if (!path || !name) continue
      const limit = Math.min(slot === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES, MAX_ARCHIVE_BYTES - total - 128 * 1024)
      const bytes = await media.downloadMedia(path, limit)
      total += bytes.length
      files[name] = bytes
    }
  }
  progress('ZIPファイルにまとめています…')
  const zipped = await zipArchive(files)
  return { blob: new Blob([zipped], { type: 'application/zip' }), name: `${set.title}.wordcards.zip` }
}
