// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BulkEditor } from './BulkImport'
import { runImport } from '@/api/transfer'
vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => <header>WordCards</header> }))
vi.mock('@/api/transfer', async original => ({ ...await original<typeof import('@/api/transfer')>(), runImport: vi.fn() }))
const clients: QueryClient[] = []
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.clearAllMocks() })
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client)
  render(<QueryClientProvider client={client}><MemoryRouter><BulkEditor setId="set" title="テスト" initialCards={[]} /></MemoryRouter></QueryClientProvider>)
}
it('連続入力してもフォーカスと値を保つ', async () => {
  open(); fireEvent.click(screen.getByRole('button', { name: /空の行を追加/ }))
  const input = screen.getByLabelText('1行目の単語')
  await userEvent.type(input, 'caterpillar')
  expect((input as HTMLInputElement).value).toBe('caterpillar'); expect(document.activeElement).toBe(input)
})
it('未入力行を外して正常行だけ登録する', async () => {
  open(); fireEvent.change(screen.getByLabelText('単語をまとめて貼り付け'), { target: { value: 'dog\ncat' } })
  fireEvent.click(screen.getByRole('button', { name: '貼り付けた単語を一覧に追加' }))
  fireEvent.click(screen.getByRole('button', { name: /空の行を追加/ }))
  expect((screen.getByRole('button', { name: '確認した内容を登録' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('3行目を登録'))
  fireEvent.click(screen.getByRole('button', { name: '確認した内容を登録' }))
  await waitFor(() => expect(runImport).toHaveBeenCalledTimes(1))
  expect(vi.mocked(runImport).mock.calls[0][0].rows.map(r => r.word)).toEqual(['dog', 'cat'])
})
it('通信失敗を表示し、同じジョブを続きから再試行する', async () => {
  vi.mocked(runImport).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  open(); fireEvent.change(screen.getByLabelText('単語をまとめて貼り付け'), { target: { value: 'dog' } })
  fireEvent.click(screen.getByRole('button', { name: '貼り付けた単語を一覧に追加' })); fireEvent.click(screen.getByRole('button', { name: '確認した内容を登録' }))
  expect((await screen.findByRole('alert')).textContent).toContain('完了した分は保存')
  fireEvent.click(screen.getByRole('button', { name: '続きから再試行' }))
  await waitFor(() => expect(runImport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(runImport).mock.calls[1][0]).toBe(vi.mocked(runImport).mock.calls[0][0])
  expect(await screen.findByRole('link', { name: '編集画面へ戻る' })).toBeDefined()
})
