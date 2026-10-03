// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './Login'

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() }))
vi.mock('@/auth/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth }, functionUrl: () => '/signup', isSupabaseConfigured: false }))
beforeEach(() => { vi.clearAllMocks(); auth.signInWithPassword.mockResolvedValue({ error: { message: 'invalid' } }); auth.resetPasswordForEmail.mockResolvedValue({ error: null }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const mount = () => render(<MemoryRouter><LoginPage /></MemoryRouter>)
it('タブ・入力属性・接続先の警告を保持する', () => {
  mount()
  const email = screen.getByLabelText('メールアドレス') as HTMLInputElement
  expect([email.type, email.inputMode, email.autocomplete, email.required]).toEqual(['email', 'email', 'email', true])
  expect(screen.getByLabelText('パスワード').getAttribute('autocomplete')).toBe('current-password')
  expect(screen.getByRole('tab', { name: 'ログイン' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByText(/接続先が設定されていません/)).toBeDefined()
  fireEvent.click(screen.getByRole('tab', { name: '新規登録' }))
  expect(screen.getByLabelText('お名前（先生の表示名）').getAttribute('autocomplete')).toBe('name')
  expect(screen.getByLabelText('パスワード').getAttribute('autocomplete')).toBe('new-password')
  expect((screen.getByLabelText('招待コード') as HTMLInputElement).required).toBe(true)
})
it('連続入力・ログインエラー・切り替え時のエラー消去を保持する', async () => {
  mount()
  await userEvent.type(screen.getByLabelText('メールアドレス'), 'teacher@example.test')
  await userEvent.type(screen.getByLabelText('パスワード'), 'fixture-password')
  fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
  await screen.findByText(/メールアドレスかパスワードが違います/)
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'teacher@example.test', password: 'fixture-password' })
  fireEvent.click(screen.getByRole('tab', { name: '新規登録' }))
  expect(screen.queryByText(/メールアドレスかパスワードが違います/)).toBeNull()
  expect((screen.getByLabelText('メールアドレス') as HTMLInputElement).value).toBe('teacher@example.test')
})
it('再設定はメールの必須確認・既存の送信先・お知らせを保持する', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'パスワードを忘れた場合' }))
  expect(screen.getByText(/先にメールアドレスを入力/)).toBeDefined()
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'teacher@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'パスワードを忘れた場合' }))
  await screen.findByText(/パスワード再設定のメールを送りました/)
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('teacher@example.test', { redirectTo: `${window.location.origin}/t/login` })
})
it('新規登録で既存の招待コードを送信し、失敗理由を表示する', async () => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: '招待コードが違います。' }), { status: 400 }))
  vi.stubGlobal('fetch', request)
  mount(); fireEvent.click(screen.getByRole('tab', { name: '新規登録' }))
  for (const [label, value] of [['お名前（先生の表示名）', '検証先生'], ['メールアドレス', 'teacher@example.test'], ['パスワード', 'fixture-password'], ['招待コード', 'fixture-invite']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'アカウントを作る' }))
  await screen.findByText(/招待コードが違います/)
  const options = request.mock.calls[0][1]
  expect(JSON.parse(options.body)).toEqual({ email: 'teacher@example.test', password: 'fixture-password', displayName: '検証先生', inviteCode: 'fixture-invite' })
  await waitFor(() => expect((screen.getByRole('button', { name: 'アカウントを作る' }) as HTMLButtonElement).disabled).toBe(false))
  expect(auth.signInWithPassword).not.toHaveBeenCalled()
})
