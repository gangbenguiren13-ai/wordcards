import { afterEach, describe, expect, it, vi } from 'vitest'
import { preloadCards, releasePreloaded } from './preload'
import type { Card } from '@/types'

const card: Card = {
  id: 'c1', set_id: 's1', word: 'apple', image_path: 'image.webp',
  pair_image_path: null, audio_path: 'audio.mp3', audio_source: 'upload', sort_order: 0,
  created_at: '', updated_at: '',
}
afterEach(() => vi.unstubAllGlobals())
describe('メディアの先読み', () => {
  it('関連画像も先読みし、終了時に解放する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('image'))
    const revoke = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:pair', revokeObjectURL: revoke })
    const result = await preloadCards([{ ...card, image_path: null, audio_path: null, pair_image_path: 'pair.webp' }], { 'pair.webp': 'https://example.invalid/pair' }, undefined, true)
    expect(result.failures).toHaveLength(0)
    expect(result.items[0].pairImageUrl).toBe('blob:pair')
    releasePreloaded(result.items); expect(revoke).toHaveBeenCalledWith('blob:pair')
  })
  it('関連画像を使うゲームでは署名欠落を拒否し、他ゲームでは要求しない', async () => {
    const c = { ...card, image_path: null, audio_path: null, pair_image_path: 'pair.webp' }
    expect((await preloadCards([c], {}, undefined, true)).failures).toHaveLength(1)
    expect((await preloadCards([c], {})).failures).toHaveLength(0)
  })
  it('登録済みメディアの署名URL欠落を失敗として返す', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await preloadCards([card], {})
    expect(result.failures).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('元からメディアのない単語カードは読み込み失敗としない', async () => {
    const result = await preloadCards([{ ...card, image_path: null, audio_path: null }], {})
    expect(result.failures).toEqual([])
    expect(result.items).toHaveLength(1)
  })
  it('通信断とHTTPエラーを失敗として返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('', { status: 503 })))
    const result = await preloadCards([card], { 'image.webp': 'https://example.invalid/image', 'audio.mp3': 'https://example.invalid/audio' })
    expect(result.failures).toHaveLength(2)
  })
})
