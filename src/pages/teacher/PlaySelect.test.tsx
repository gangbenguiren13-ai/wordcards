// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlaySelectPage } from './PlaySelect'
import { getSet, getCards } from '@/api/sets'
import type { Card, MaterialSet } from '@/types'
vi.mock('@/api/sets', () => ({ getSet: vi.fn(), getCards: vi.fn() }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <header>WordCards</header> }))
const material = { id: 'test', title: '検証用', mode: 'junior', default_display: 'word_only', games_config: {}, audio_enabled: false } as MaterialSet
const card = { id: 'card', word: 'apple', image_path: null, audio_path: null, pair_image_path: null } as Card
let client: QueryClient
beforeEach(() => { vi.mocked(getSet).mockResolvedValue(material); vi.mocked(getCards).mockResolvedValue([card]) })
afterEach(() => { cleanup(); client.clear() })
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/t/sets/test/play']}><Routes><Route path="/t/sets/:id/play" element={<PlaySelectPage />} /></Routes></MemoryRouter></QueryClientProvider>)
}
it('使える3タイルは今までと同じ設定URLへ進む', async () => {
  mount(); await screen.findByRole('heading', { name: 'ゲームをえらぶ' })
  for (const [name, game] of [['フラッシュカード', 'flashcards'], ['神経衰弱', 'memory'], ['Slow Reveal', 'slowreveal']]) expect(screen.getByRole('link', { name: new RegExp(name) }).getAttribute('href')).toBe(`/t/sets/test/play/${game}`)
  expect(screen.getByText('1枚・中学校')).toBeDefined()
})
it.each(['empty', 'blocked'])('使用不可はリンクを作らず、理由と編集リンクを残す（%s）', async scenario => {
  vi.mocked(getCards).mockResolvedValue(scenario === 'empty' ? [] : [{ ...card, word: '' }])
  mount(); await screen.findByRole('heading', { name: 'ゲームをえらぶ' })
  expect(screen.queryByRole('link', { name: /フラッシュカード/ })).toBeNull()
  expect(document.querySelectorAll('.teacher-game-disabled[aria-disabled="true"]')).toHaveLength(3)
  expect(screen.getByRole('link', { name: scenario === 'empty' ? 'カードを追加する' : '教材セットを直しに行く' }).getAttribute('href')).toBe('/t/sets/test/edit')
  expect(screen.getByText(scenario === 'empty' ? /カードがまだありません/ : /なおすまでゲームを始められません/)).toBeDefined()
})
