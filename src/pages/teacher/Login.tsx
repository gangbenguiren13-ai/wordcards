import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase, functionUrl, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/auth/useAuth'
import { Button, TextField } from '@/components/ui'

type Tab = 'login' | 'signup'

export function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/t/home'} replace />
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError('メールアドレスかパスワードが違います。')
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(functionUrl('signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, inviteCode, displayName }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'アカウントを作成できませんでした。')
        return
      }
      // 作成後そのままログインする
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setNotice('アカウントを作成しました。ログインタブからログインしてください。')
        setTab('login')
      }
    } catch {
      setError('通信できませんでした。ネットワークを確認してください。')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!email) {
      setError('先にメールアドレスを入力してください。')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/t/login`,
    })
    setBusy(false)
    setNotice(
      error
        ? null
        : 'パスワード再設定のメールを送りました。メールを確認してください。',
    )
    if (error) setError('メールを送れませんでした。')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-brand-700">WordCards</h1>
        <p className="mt-1 text-ink-soft">英語のフラッシュカードとミニゲーム</p>
      </header>

      {!isSupabaseConfigured && (
        <p className="rounded-xl border-2 border-danger-500 bg-danger-50 p-4 text-sm font-bold text-danger-700">
          ⚠ 接続先が設定されていません。導入手順.md の「環境変数」の手順を確認してください。
        </p>
      )}

      <div className="flex gap-2" role="tablist">
        {(['login', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
              setError(null)
              setNotice(null)
            }}
            className={[
              'min-h-11 flex-1 rounded-xl border-2 font-bold',
              tab === t
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line bg-surface text-ink-soft',
            ].join(' ')}
          >
            {t === 'login' ? 'ログイン' : '新規登録'}
          </button>
        ))}
      </div>

      <form
        onSubmit={tab === 'login' ? handleLogin : handleSignup}
        className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm"
      >
        {tab === 'signup' && (
          <TextField
            label="お名前（先生の表示名）"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        )}
        <TextField
          label="メールアドレス"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="パスワード"
          type="password"
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={tab === 'signup' ? '8文字以上' : undefined}
        />
        {tab === 'signup' && (
          <TextField
            label="招待コード"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            hint="管理の先生から聞いたコードを入力してください"
          />
        )}

        {error && (
          <p className="rounded-xl border-2 border-danger-500 bg-danger-50 p-3 text-sm font-bold text-danger-700">
            ⚠ {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border-2 border-ok-500 bg-ok-50 p-3 text-sm font-bold text-ok-700">
            ✓ {notice}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? '処理中…' : tab === 'login' ? 'ログイン' : 'アカウントを作る'}
        </Button>

        {tab === 'login' && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-bold text-brand-600 underline"
          >
            パスワードを忘れた場合
          </button>
        )}
      </form>
    </main>
  )
}
