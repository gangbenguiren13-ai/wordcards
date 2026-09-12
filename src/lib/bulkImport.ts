import Papa from 'papaparse'
import type { Card } from '@/types'
import { AUDIO_EXTENSIONS, CARDS_HARD_LIMIT, WORD_MAX } from './constants'
import { extOf, fileNameToKey, looseKey, normalizeWord } from './normalize'
import { checkUploadFile } from './validation'

export type Slot = 'image' | 'pairImage' | 'audio'
export const SLOTS: Slot[] = ['image', 'pairImage', 'audio']
export const SLOT_LABELS = { image: '画像', pairImage: '関連画像', audio: '音声' }
export interface DraftRow {
  id: string
  word: string
  order: number
  existing?: Card
  expected: Partial<Record<Slot, string>>
  files: Partial<Record<Slot, File>>
  selected: boolean
  error?: string
}
export interface PendingFile { id: string; file: File; reason: string }
export function draftRow(word = '', order = 0): DraftRow {
  return { id: crypto.randomUUID(), word, order, expected: {}, files: {}, selected: true }
}
export function existingRows(cards: Card[]): DraftRow[] {
  return cards.map(c => ({ ...draftRow(c.word, c.sort_order), id: c.id, existing: c }))
}
export function rowError(row: DraftRow): string | undefined {
  if (row.error) return row.error
  if (!row.word.trim()) return '単語を入力してください'
  if (row.word.trim().length > WORD_MAX) return `単語は${WORD_MAX}文字までです`
}
export function fileSlot(file: File): 'image' | 'audio' {
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extOf(file.name)) ? 'audio' : 'image'
}
export function slotPath(card: Card, slot: Slot) {
  return slot === 'image' ? card.image_path : slot === 'pairImage' ? card.pair_image_path : card.audio_path
}
export function decodeTable(bytes: Uint8Array): { text: string; encoding: string } {
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' } }
  catch {
    try { return { text: new TextDecoder('shift_jis', { fatal: true }).decode(bytes), encoding: 'Shift_JIS' } }
    catch { throw new Error('文字コードを読み取れません。UTF-8またはShift_JISのCSV/TSVで保存してください。') }
  }
}
export function parseTable(text: string): DraftRow[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimitersToGuess: [',', '\t'], skipEmptyLines: 'greedy',
  })
  const headers = (parsed.data[0] ?? []).map(s => s.trim().toLowerCase())
  if (!headers.includes('word')) throw new Error('1行目に word 列が必要です。サンプルCSVをお使いください。')
  const columns = ['word', 'image_file', 'pair_image_file', 'audio_file', 'sort_order']
  if (columns.some(k => headers.filter(h => h === k).length > 1)) throw new Error('同じ列名が重複しています。')
  if (parsed.errors.some(e => e.code === 'MissingQuotes' || e.code === 'InvalidQuotes')) throw new Error('引用符の閉じ方を確認してください。CSVを最後まで読み取れません。')
  if (parsed.data.length - 1 > CARDS_HARD_LIMIT) throw new Error(`一度に読み込めるのは${CARDS_HARD_LIMIT}行までです。`)
  return parsed.data.slice(1).map((cells, index) => {
    const value = (key: string) => cells[headers.indexOf(key)]?.trim() ?? ''
    const order = value('sort_order')
    const row = draftRow(value('word'), order ? Number(order) : index)
    row.expected = { image: value('image_file'), pairImage: value('pair_image_file'), audio: value('audio_file') }
    if (cells.length !== headers.length) row.error = '列の数が見出しと一致しません'
    if (order && (!/^-?\d+$/.test(order) || !Number.isSafeInteger(row.order))) row.error = 'sort_orderは整数で入力してください'
    return row
  }).sort((a, b) => a.order - b.order)
}

/** No partial/fuzzy match; every ambiguous candidate is left for the teacher. */
export function matchFiles(inputRows: DraftRow[], inputFiles: File[]) {
  const rows = inputRows.map(r => ({ ...r, files: { ...r.files } }))
  const pending: PendingFile[] = []
  const proposals: { file: File; row: DraftRow; slot: Slot }[] = []
  for (const file of inputFiles) {
    const kind = fileSlot(file)
    const issue = checkUploadFile(file, kind)
    if (issue) { pending.push({ id: crypto.randomUUID(), file, reason: issue.message }); continue }
    const slots: Slot[] = kind === 'audio' ? ['audio'] : ['image', 'pairImage']
    const exact = rows.flatMap(row => slots.filter(slot => row.expected[slot] && normalizeWord(row.expected[slot]!) === normalizeWord(file.name)).map(slot => ({ row, slot })))
    const key = fileNameToKey(file.name)
    const candidates = (keyToMatch: string) => rows.filter(row => !row.expected[kind] && normalizeWord(row.word) === keyToMatch).map(row => ({ row, slot: kind as Slot }))
    let matches = exact.length ? exact : candidates(key)
    if (!matches.length && looseKey(key) !== key) matches = candidates(looseKey(key))
    if (matches.length !== 1) {
      pending.push({ id: crypto.randomUUID(), file, reason: matches.length ? '対応先が複数あります' : '対応する単語がありません' }); continue
    }
    const { row, slot } = matches[0]
    if (row.files[slot] || (row.existing && slotPath(row.existing, slot))) {
      pending.push({ id: crypto.randomUUID(), file, reason: '対応先にはすでにファイルがあります' }); continue
    }
    proposals.push({ file, row, slot })
  }
  for (const p of proposals) {
    if (proposals.filter(q => q.row.id === p.row.id && q.slot === p.slot).length > 1) {
      pending.push({ id: crypto.randomUUID(), file: p.file, reason: '同じ単語への候補が複数あります' })
    } else p.row.files[p.slot] = p.file
  }
  return { rows, pending }
}

export function wordsFromFiles(rows: DraftRow[], files: File[]): DraftRow[] {
  const next = [...rows]
  for (const file of files) {
    if (checkUploadFile(file, fileSlot(file))) continue
    const word = file.name.replace(/\.[^.]+$/, '').trim()
    if (!next.some(r => normalizeWord(r.word) === normalizeWord(word))) next.push(draftRow(word, next.length))
  }
  if (next.length > CARDS_HARD_LIMIT) throw new Error(`カードは${CARDS_HARD_LIMIT}枚までです。`)
  return next
}
