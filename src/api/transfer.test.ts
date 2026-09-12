import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCards, getSet } from './sets'
import { exportSet, importJob, runImport } from './transfer'
import { draftRow, existingRows } from '@/lib/bulkImport'
import { archiveManifest } from '@/lib/setArchive'
import * as media from '@/lib/mediaStore'
import type { Card, MaterialSet } from '@/types'

const db = vi.hoisted(() => ({ cards: new Map<string, Record<string, unknown>>(), sets: new Map<string, Record<string, unknown>>(), loseInsert: false, loseUpdate: false, insertCalls: 0 }))
vi.mock('@/api/sets', () => ({ getCards: vi.fn(), getSet: vi.fn() }))
vi.mock('@/lib/mediaStore', () => ({ uploadImportFile: vi.fn(), downloadMedia: vi.fn() }))
vi.mock('@/lib/imageCompress', () => ({ compressImage: vi.fn(async (f: File) => ({ blob: new Blob([await f.arrayBuffer()], { type: 'image/webp' }) })) }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => ({
  upsert: async (row: Record<string, unknown>, options: { ignoreDuplicates: boolean }) => {
    const target = table === 'cards' ? db.cards : db.sets
    expect(options.ignoreDuplicates).toBe(true)
    if (!target.has(row.id as string)) target.set(row.id as string, { image_path: null, pair_image_path: null, audio_path: null, ...row })
    db.insertCalls++
    if (db.loseInsert && table === 'cards') { db.loseInsert = false; return { error: new Error('response lost') } }
    return { error: null }
  },
  update: (patch: Record<string, unknown>) => ({ eq: (_: string, id: string) => ({ eq: () => ({ select: () => ({ single: async () => {
    db.cards.set(id, { ...db.cards.get(id), ...patch })
    if (db.loseUpdate) { db.loseUpdate = false; return { error: new Error('response lost') } }
    return { error: null }
  } }) }) }) }),
}) } }))
const material = { id: 'set', owner_id: 'owner', title: 'Animals', mode: 'junior', default_display: 'word_image', audio_enabled: true, show_word_on_answer: false, games_config: {}, deleted_at: null } as MaterialSet
const oldCard = { id: 'old', set_id: 'set', word: 'cat', sort_order: 0, image_path: 'old-file', pair_image_path: null, audio_path: null } as Card
beforeEach(() => {
  vi.clearAllMocks(); db.cards.clear(); db.sets.clear(); db.loseInsert = false; db.loseUpdate = false; db.insertCalls = 0
  vi.mocked(getSet).mockImplementation(async id => ({ ...material, ...(db.sets.get(id) ?? {}), id } as MaterialSet))
  vi.mocked(getCards).mockImplementation(async () => [...db.cards.values()] as unknown as Card[])
  vi.mocked(media.uploadImportFile).mockImplementation(async (owner, set, card, kind, op, _blob, ext) => `${owner}/${set}/${card}/${kind}-${op}.${ext}`)
  vi.mocked(media.downloadMedia).mockResolvedValue(new Uint8Array([1, 2]))
})
describe('一括保存の再試行', () => {
  it('INSERTの応答だけ失われても同じカードを重複作成しない', async () => {
    const row = draftRow('cat'); const job = importJob('owner', 'set', [row]); db.loseInsert = true
    await expect(runImport(job, vi.fn())).rejects.toThrow('response lost')
    await runImport(job, vi.fn())
    expect(db.cards.size).toBe(1); expect(db.cards.get(row.id)?.word).toBe('cat'); expect(job.completeRows).toBe(1)
  })
  it('途中のアップロード失敗後、完了した画像を繰り返し送らず再開する', async () => {
    const row = draftRow('cat'); row.files = { image: new File(['img'], 'cat.png'), audio: new File(['mp3'], 'cat.mp3') }
    const upload = vi.mocked(media.uploadImportFile)
    upload.mockResolvedValueOnce('new-image').mockRejectedValueOnce(new Error('offline'))
    const job = importJob('owner', 'set', [row])
    await expect(runImport(job, vi.fn())).rejects.toThrow('offline')
    await runImport(job, vi.fn())
    expect(db.cards.size).toBe(1); expect(upload).toHaveBeenCalledTimes(3)
    expect(db.cards.get(row.id)?.image_path).toBe('new-image')
  })
  it('メディアUPDATEの応答だけ失われた場合も重複アップロードしない', async () => {
    const row = draftRow('cat'); row.files.audio = new File(['mp3'], 'cat.mp3')
    const job = importJob('owner', 'set', [row]); db.loseUpdate = true
    await expect(runImport(job, vi.fn())).rejects.toThrow()
    await runImport(job, vi.fn())
    expect(media.uploadImportFile).toHaveBeenCalledTimes(1)
  })
  it('既存画像の差し替えは別のパスへ保存する', async () => {
    db.cards.set(oldCard.id, { ...oldCard })
    const row = existingRows([oldCard])[0]; row.files.image = new File(['png'], 'cat.png')
    await runImport(importJob('owner', 'set', [row]), vi.fn())
    expect(db.cards.get('old')?.word).toBe('cat')
    expect(db.cards.get('old')?.image_path).toMatch(/^owner\/set\/old\/image-/)
  })
  it('別画面で差し替えられたファイルを上書きしない', async () => {
    db.cards.set('old', { ...oldCard, image_path: 'edited-elsewhere' })
    const row = existingRows([oldCard])[0]; row.files.image = new File(['x'], 'cat.jpg')
    await expect(runImport(importJob('owner', 'set', [row]), vi.fn())).rejects.toThrow('別の画面')
    expect(media.uploadImportFile).not.toHaveBeenCalled()
  })
  it('最新枚数で200枚上限を確認してから追加する', async () => {
    vi.mocked(getCards).mockResolvedValue(Array.from({ length: 200 }, (_, i) => ({ ...oldCard, id: `${i}` })))
    await expect(runImport(importJob('owner', 'set', [draftRow('extra')]), vi.fn())).rejects.toThrow('200')
    expect(db.insertCalls).toBe(0)
  })
  it('復元先は共有オフで設定を保ち、途中失敗でも新しい教材を増やさない', async () => {
    const row = draftRow('cat'), archive = { archive: archiveManifest(material, [oldCard], false), rows: [row], missing: [] }
    const job = importJob('owner', 'new-set', [row], archive); db.loseInsert = true
    await expect(runImport(job, vi.fn())).rejects.toThrow()
    await runImport(job, vi.fn())
    expect(db.sets.size).toBe(1)
    expect(db.sets.get('new-set')).toMatchObject({ share_enabled: false, share_token: null, school_shared: false, default_display: 'word_image' })
  })
  it('ZIP用メディア取得が1件でも失敗したら成功ファイルを返さない', async () => {
    db.cards.set('old', { ...oldCard }); vi.mocked(media.downloadMedia).mockRejectedValue(new Error('offline'))
    await expect(exportSet('set', true, vi.fn())).rejects.toThrow('offline')
  })
  it('JSON書き出しはメディアを通信しない', async () => {
    db.cards.set('old', { ...oldCard })
    const result = await exportSet('set', false, vi.fn())
    expect(media.downloadMedia).not.toHaveBeenCalled()
    expect(JSON.parse(await result.blob.text()).set.cards[0].image).toBeNull()
  })
})
