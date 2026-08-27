// 招待コードを検証してから教師アカウントを作成する。
// service_role キーは Supabase 側の環境変数にのみ存在し、ブラウザには出ない。
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { clientIp, corsHeaders, json, timingSafeEqual } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const inviteCode = Deno.env.get('INVITE_CODE') ?? ''

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- レート制限: IPごと 5回/時 -------------------------------------
  const ip = clientIp(req)
  const { data: allowed, error: rlError } = await admin.rpc('bump_rate_limit', {
    p_bucket: `signup:${ip}`,
    p_limit: 5,
    p_window_seconds: 3600,
  })
  if (rlError) console.error('rate limit error', rlError)
  if (allowed === false) {
    return json({ error: 'RATE_LIMIT', message: '試行回数が多すぎます。しばらく待ってから試してください。' }, 429)
  }

  let body: { email?: string; password?: string; inviteCode?: string; displayName?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400)
  }

  const { email, password, displayName } = body
  if (!email || !password) {
    return json({ error: 'BAD_REQUEST', message: 'メールアドレスとパスワードを入力してください。' }, 400)
  }
  if (password.length < 8) {
    return json({ error: 'WEAK_PASSWORD', message: 'パスワードは8文字以上にしてください。' }, 400)
  }
  if (!inviteCode) {
    console.error('INVITE_CODE が未設定です')
    return json({ error: 'SERVER_MISCONFIGURED', message: 'サーバー設定が未完了です。管理者に連絡してください。' }, 500)
  }
  if (!timingSafeEqual(body.inviteCode ?? '', inviteCode)) {
    return json({ error: 'INVALID_INVITE', message: '招待コードが正しくありません。' }, 403)
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 校内運用のため確認メールなしで有効化する
    user_metadata: { display_name: displayName ?? '' },
  })

  if (error) {
    const already = error.message.toLowerCase().includes('already')
    return json(
      {
        error: already ? 'EMAIL_TAKEN' : 'SIGNUP_FAILED',
        message: already
          ? 'このメールアドレスは既に登録されています。ログインしてください。'
          : 'アカウントを作成できませんでした。',
      },
      already ? 409 : 400,
    )
  }

  return json({ ok: true, userId: data.user?.id })
})
