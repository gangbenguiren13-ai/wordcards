import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { archiveManifest, parseArchive, readArchiveFile, readZip } from './setArchive'
import { defaultGamesConfig } from './gameDefaults'
import type { MaterialSet, Card } from '@/types'

const set = { id: 'private-set-id', owner_id: 'private-owner', title: 'どうぶつ', mode: 'elementary', default_display: 'image_only', audio_enabled: true, show_word_on_answer: false, games_config: defaultGamesConfig('elementary'), share_token: 'secret-share-token', share_enabled: true } as MaterialSet
const card = { id: 'private-card', set_id: set.id, word: 'dog', sort_order: 4, image_path: 'private-owner/set/card/image.webp', pair_image_path: 'private-owner/set/card/pair.webp', audio_path: 'private-owner/set/card/audio.m4a' } as Card
describe('教材アーカイブ', () => {
  it('所有者ID・カードID・共有トークン・署名URLを書き出さない', () => {
    const manifest = archiveManifest(set, [card], true)
    expect(JSON.stringify(manifest)).not.toMatch(/private-|secret-share|share_enabled|owner_id|https:/)
    expect(manifest.set.cards[0].audio).toBe('media/1.audio.m4a')
    expect(parseArchive(JSON.stringify(manifest)).set.gamesConfig).toEqual(set.games_config)
  })
  it('JSONのみの書き出しはメディア参照を残さない', () => {
    expect(archiveManifest(set, [card], false).set.cards[0]).toEqual({ word: 'dog', sortOrder: 4, image: null, pairImage: null, audio: null })
  })
  it('画像・関連画像・音声付きZIPを別IDの下書きへ戻す', async () => {
    const manifest = archiveManifest(set, [card], true)
    const files = { 'set.json': strToU8(JSON.stringify(manifest)), 'media/1.image.webp': new Uint8Array([1, 2]), 'media/1.pair.webp': new Uint8Array([3, 4]), 'media/1.audio.m4a': new Uint8Array([5, 6]) }
    const result = await readArchiveFile(new File([zipSync(files)], 'animals.zip'))
    expect(result.archive.set).toEqual(manifest.set); expect(result.rows[0].id).not.toBe(card.id)
    expect(new Uint8Array(await result.rows[0].files.audio!.arrayBuffer())).toEqual(files['media/1.audio.m4a'])
    expect(result.missing).toHaveLength(0)
  })
  it('進行中の空単語も復元し、順序を保つ', () => {
    const manifest = archiveManifest(set, [{ ...card, word: '', sort_order: 10 }, { ...card, word: 'cat', sort_order: 2 }], false)
    expect(parseArchive(JSON.stringify(manifest)).set.cards.map(c => c.word)).toEqual(['cat', ''])
  })
  it('v1の省略されたゲーム既定値を補う', () => {
    const manifest = archiveManifest(set, [], false)
    const raw = JSON.parse(JSON.stringify(manifest)); raw.set.gamesConfig = { flashcards: { enabledForStudents: true } }
    const games = parseArchive(JSON.stringify(raw)).set.gamesConfig
    expect(games.flashcards?.defaults.autoSeconds).toBe(3); expect(games.memory).toBeUndefined()
  })
  it.each(['https://example.org/file.jpg', '../file.jpg', 'media/../file.jpg', 'media\\file.jpg', '/media/file.jpg', 'media/file.svg'])('外部URL・危険な参照を拒否: %s', path => {
    const raw = archiveManifest(set, [card], true); raw.set.cards[0].image = path
    expect(() => parseArchive(JSON.stringify(raw))).toThrow()
  })
  it('未知の形式・巨大な設定値・DB整数上限超を拒否する', () => {
    const raw = JSON.parse(JSON.stringify(archiveManifest(set, [card], false)))
    raw.formatVersion = 99; expect(() => parseArchive(JSON.stringify(raw))).toThrow()
    raw.formatVersion = 1; raw.set.gamesConfig.memory.defaults.teams = 100000; expect(() => parseArchive(JSON.stringify(raw))).toThrow()
    delete raw.set.gamesConfig.memory; raw.set.cards[0].sortOrder = 999999999999; expect(() => parseArchive(JSON.stringify(raw))).toThrow()
  })
  it('ZIPの欠落は拒否し、JSONの欠落は明示確認用に報告する', async () => {
    const json = JSON.stringify(archiveManifest(set, [card], true))
    await expect(readArchiveFile(new File([zipSync({ 'set.json': strToU8(json) })], 'bad.zip'))).rejects.toThrow('必要なファイル')
    expect((await readArchiveFile(new File([json], 'set.json'))).missing).toHaveLength(3)
  })
  it('壊れたZIPとパストラバーサルを拒否する', async () => {
    const zipped = zipSync({ 'set.json': strToU8('{}') })
    await expect(readZip(zipped.slice(0, -5))).rejects.toThrow('不完全')
    await expect(readZip(zipSync({ '../evil.png': new Uint8Array([1]) }))).rejects.toThrow()
  })
  it('サイズヘッダを偽った高圧縮ファイルを実バイト数で止める', async () => {
    const zipped = zipSync({ 'media/bomb.mp3': new Uint8Array(3 * 1024 * 1024) }, { level: 9 })
    new DataView(zipped.buffer).setUint32(22, 1, true) // fake original size in the local header
    await expect(readZip(zipped)).rejects.toThrow('容量')
  })
})
