import { strToU8, Unzip, UnzipInflate, zip } from 'fflate'
import { defaultGamesConfig } from './gameDefaults'
import { CARDS_HARD_LIMIT, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, TITLE_MAX, WORD_MAX } from './constants'
import { checkUploadFile } from './validation'
import { draftRow, SLOTS, type DraftRow, type Slot } from './bulkImport'
import { DISPLAY_MODE_LABELS, type GamesConfig, type MaterialSet, type Card, type SetMode } from '@/types'
import { extOf } from './normalize'

export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
export const MAX_JSON_BYTES = 2 * 1024 * 1024
export interface PortableCard { word: string; image: string | null; pairImage: string | null; audio: string | null; sortOrder: number }
export interface SetArchive {
  format: 'wordcards-set'; formatVersion: 1; exportedAt: string
  set: { title: string; mode: SetMode; defaultDisplay: MaterialSet['default_display']; audioEnabled: boolean; showWordOnAnswer: boolean; gamesConfig: GamesConfig; cards: PortableCard[] }
}
export interface ArchivePreview { archive: SetArchive; rows: DraftRow[]; missing: string[] }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('教材ファイルの形式が正しくありません。')
  return value as Record<string, unknown>
}
function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error('設定のオン／オフが正しくありません。')
  return value
}
const enums: Record<string, readonly unknown[]> = {
  order: ['sequential', 'random'], pick: ['sequential', 'random'], advance: ['manual', 'auto'],
  display: [null, ...Object.keys(DISPLAY_MODE_LABELS)], reviewMode: ['mixed', 'rounds'], cardCount: [8, 12, 16, 20],
  pairType: ['word_image', 'word_word', 'image_image', 'image_pairimage'], direction: ['top', 'bottom', 'left', 'right', 'center'],
  answerDisplay: ['image', 'image_word', 'image_word_audio'],
}
const ranges: Record<string, [number, number]> = { autoSeconds: [1, 10], teams: [1, 4], steps: [4, 12], timeLimitMinutes: [1, 10] }
/** Only known game fields cross the transport boundary. Missing defaults support v1 examples. */
export function portableGames(value: unknown, mode: SetMode): GamesConfig {
  const input = object(value ?? {})
  const base = defaultGamesConfig(mode)
  const out: Record<string, unknown> = {}
  for (const game of ['flashcards', 'memory', 'slowreveal'] as const) {
    if (input[game] === undefined) continue
    const entry = object(input[game])
    const original = base[game]!
    const defaults: Record<string, unknown> = { ...original.defaults }
    const supplied = object(entry.defaults ?? {})
    for (const key of Object.keys(defaults)) {
      if (supplied[key] === undefined) continue
      const v = supplied[key]
      if (enums[key]) { if (!enums[key].includes(v)) throw new Error(`${game}の${key}の値が正しくありません。`) }
      else if (ranges[key]) {
        const [min, max] = ranges[key]
        if (!(key === 'timeLimitMinutes' && v === null) && (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)) throw new Error(`${game}の${key}の範囲が正しくありません。`)
      } else if (typeof v !== 'boolean') throw new Error(`${game}の${key}の値が正しくありません。`)
      defaults[key] = v
    }
    const adjustable = entry.studentAdjustable ?? original.studentAdjustable
    if (!Array.isArray(adjustable) || adjustable.some(k => typeof k !== 'string')) throw new Error('生徒用の設定が正しくありません。')
    out[game] = { enabledForStudents: bool(entry.enabledForStudents, false), defaults, studentAdjustable: adjustable.filter(k => Object.hasOwn(defaults, k)) }
  }
  return out as GamesConfig
}
function mediaRef(value: unknown, slot: Slot): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^media\/[^/\\:]+$/.test(value) || value.includes('..') || Array.from(value).some(c => c.charCodeAt(0) < 32)) throw new Error('画像・音声の参照先はZIP内のmediaフォルダだけ指定できます。')
  const testFile = new File([], value.slice(6))
  const issue = checkUploadFile(testFile, slot === 'audio' ? 'audio' : 'image')
  if (issue) throw new Error(issue.message)
  return value
}
export function parseArchive(text: string): SetArchive {
  if (strToU8(text).length > MAX_JSON_BYTES) throw new Error('JSONは2MBまでです。')
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('JSONの内容を読み取れません。') }
  const root = object(raw)
  if (root.format !== 'wordcards-set' || root.formatVersion !== 1) throw new Error('対応していない教材ファイルです（対応形式：wordcards-set、バージョン1）。')
  const s = object(root.set)
  if (typeof s.title !== 'string' || !s.title.trim() || s.title.trim().length > TITLE_MAX) throw new Error('教材名は1〜60文字で指定してください。')
  if (s.mode !== 'elementary' && s.mode !== 'junior') throw new Error('教材の学校モードが正しくありません。')
  if (typeof s.defaultDisplay !== 'string' || !Object.hasOwn(DISPLAY_MODE_LABELS, s.defaultDisplay)) throw new Error('カードの表示設定が正しくありません。')
  if (!Array.isArray(s.cards) || s.cards.length > CARDS_HARD_LIMIT) throw new Error(`カード一覧は${CARDS_HARD_LIMIT}枚までです。`)
  const cards = s.cards.map((value, i) => {
    const c = object(value)
    // In-progress cards can be backed up, including an empty word.
    if (typeof c.word !== 'string' || c.word.length > WORD_MAX) throw new Error(`${i + 1}枚目の単語は50文字までの文字列にしてください。`)
    if (c.sortOrder !== undefined && (typeof c.sortOrder !== 'number' || !Number.isInteger(c.sortOrder) || Math.abs(c.sortOrder) > 2147483647)) throw new Error(`${i + 1}枚目の順序が正しくありません。`)
    return { word: c.word, image: mediaRef(c.image, 'image'), pairImage: mediaRef(c.pairImage, 'pairImage'), audio: mediaRef(c.audio, 'audio'), sortOrder: (c.sortOrder as number | undefined) ?? i }
  }).sort((a, b) => a.sortOrder - b.sortOrder)
  return { format: 'wordcards-set', formatVersion: 1, exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt.slice(0, 50) : '', set: {
    title: s.title.trim(), mode: s.mode, defaultDisplay: s.defaultDisplay as MaterialSet['default_display'],
    audioEnabled: bool(s.audioEnabled, true), showWordOnAnswer: bool(s.showWordOnAnswer, false), gamesConfig: portableGames(s.gamesConfig, s.mode), cards,
  } }
}
export function archiveManifest(set: MaterialSet, cards: Card[], withMedia: boolean): SetArchive {
  return { format: 'wordcards-set', formatVersion: 1, exportedAt: new Date().toISOString(), set: {
    title: set.title, mode: set.mode, defaultDisplay: set.default_display, audioEnabled: set.audio_enabled,
    showWordOnAnswer: set.show_word_on_answer, gamesConfig: portableGames(set.games_config, set.mode),
    cards: cards.map((c, i) => ({ word: c.word, image: withMedia && c.image_path ? `media/${i + 1}.image.${extOf(c.image_path)}` : null,
      pairImage: withMedia && c.pair_image_path ? `media/${i + 1}.pair.${extOf(c.pair_image_path)}` : null,
      audio: withMedia && c.audio_path ? `media/${i + 1}.audio.${extOf(c.audio_path)}` : null, sortOrder: c.sort_order })),
  } }
}
export async function zipArchive(files: Record<string, Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => zip(files, { level: 0 }, (e, data) => e ? reject(e) : resolve(data)))
}
/** Bound actual inflated bytes, not just ZIP header claims. Never writes archive paths to disk. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new Error('ZIPは100MBまでです。教材を分けてください。')
  // A complete standard ZIP must end with an end-of-central-directory record.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break }
  }
  if (end < 0) throw new Error('ZIPが不完全です。もう一度書き出してください。')
  const result = new Map<string, Uint8Array<ArrayBuffer>>()
  const names = new Set<string>()
  let total = 0, finished = 0, count = 0
  const unzip = new Unzip(file => {
    if (file.name === 'media/') return
    if (++count > 601 || names.has(file.name)) throw new Error('ZIP内のファイル数が多すぎるか、名前が重複しています。')
    names.add(file.name)
    if (file.name !== 'set.json') mediaRef(file.name, ['mp3', 'm4a'].includes(extOf(file.name)) ? 'audio' : 'image')
    const limit = file.name === 'set.json' ? MAX_JSON_BYTES : ['mp3', 'm4a'].includes(extOf(file.name)) ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES
    if ((file.originalSize ?? 0) > limit) throw new Error(`「${file.name}」が容量上限を超えています。`)
    const chunks: Uint8Array[] = []
    let size = 0
    file.ondata = (error, data, final) => {
      if (error) throw error
      size += data.length; total += data.length
      if (size > limit || total > MAX_ARCHIVE_BYTES) { file.terminate(); throw new Error('展開後のファイル容量が上限を超えています。') }
      chunks.push(data)
      if (final) {
        const output = new Uint8Array(size)
        let at = 0
        for (const chunk of chunks) { output.set(chunk, at); at += chunk.length }
        result.set(file.name, output); finished++
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  for (let i = 0; i < bytes.length; i += 16384) {
    unzip.push(bytes.subarray(i, i + 16384), i + 16384 >= bytes.length)
    if (i % (1024 * 1024) === 0) await new Promise(resolve => setTimeout(resolve, 0))
  }
  if (!result.has('set.json') || finished !== count) throw new Error('ZIPが不完全です。set.jsonを含む教材ZIPを選択してください。')
  return result
}
export async function readArchiveFile(file: File): Promise<ArchivePreview> {
  const isZip = extOf(file.name) === 'zip'
  if (!isZip && extOf(file.name) !== 'json') throw new Error('JSONまたはZIPを選んでください。')
  if (file.size > (isZip ? MAX_ARCHIVE_BYTES : MAX_JSON_BYTES)) throw new Error(isZip ? 'ZIPは100MBまでです。' : 'JSONは2MBまでです。')
  const files = isZip ? await readZip(new Uint8Array(await file.arrayBuffer())) : new Map<string, Uint8Array<ArrayBuffer>>()
  const archive = parseArchive(isZip ? new TextDecoder('utf-8', { fatal: true }).decode(files.get('set.json')) : await file.text())
  const missing: string[] = []
  const rows = archive.set.cards.map(c => {
    const row = draftRow(c.word, c.sortOrder)
    for (const slot of SLOTS) {
      const ref = c[slot]
      if (!ref) continue
      const content = files.get(ref)
      if (!content) { missing.push(ref); continue }
      const type = slot === 'audio' ? extOf(ref) === 'mp3' ? 'audio/mpeg' : 'audio/mp4' : `image/${extOf(ref) === 'jpg' ? 'jpeg' : extOf(ref)}`
      row.files[slot] = new File([content], ref.slice(6), { type })
    }
    return row
  })
  if (isZip && missing.length) throw new Error(`ZIPに必要なファイルがありません：${missing[0]}。もう一度書き出してください。`)
  return { archive, rows, missing }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename.replace(/[\\/:*?"<>|]/g, '_')
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
