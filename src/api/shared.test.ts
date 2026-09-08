// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSharedSet, sharedGameData } from './shared'
import { defaultGamesConfig } from '@/lib/gameDefaults'
vi.mock('@/lib/supabase', () => ({ functionUrl: () => 'https://example.test/functions/v1/shared-set' }))
afterEach(() => vi.unstubAllGlobals())
describe('共有窓口', () => {
  it('不正なトークンは通信せず拒否する', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(fetchSharedSet('invalid')).rejects.toMatchObject({ status: 404 })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([404, 429, 503])('HTTP %s を生徒向けエラーにする', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(fetchSharedSet('abcdefghijklmnopqrstu')).rejects.toMatchObject({ status })
  })
  it('生徒用取得はセッション情報を使わず再検証する', async () => {
    const p = { set: {}, cards: [] }
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => p }); vi.stubGlobal('fetch', f)
    expect(await fetchSharedSet('abcdefghijklmnopqrstu')).toEqual(p)
    expect(f).toHaveBeenCalledWith(expect.stringContaining('?token=abcdefghijklmnopqrstu'), expect.objectContaining({ credentials: 'omit', cache: 'no-store' }))
  })
  it('共通ゲーム用データに教師情報を要求しない', () => {
    const result = sharedGameData({ set: { title: '動物', mode: 'elementary', defaultDisplay: 'image_only', audioEnabled: true,
      showWordOnAnswer: false, gamesConfig: defaultGamesConfig('elementary') }, cards: [
      { id: 'c', word: 'cat', imageUrl: 'https://example.test/signed', audioUrl: null, pairImageUrl: null, sortOrder: 0 },
    ] })
    expect(result.set.owner_id).toBe('')
    expect(result.urls[result.cards[0].image_path!]).toBe('https://example.test/signed')
  })
})
