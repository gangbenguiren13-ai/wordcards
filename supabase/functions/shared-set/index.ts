// 生徒アクセスの唯一の入口。
// 共有トークンを検証し、セット・カードと署名付きURLを返す。
// 一覧APIや部分一致検索は提供しない（列挙を防ぐため）。
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { clientIp, corsHeaders, json } from '../_shared/cors.ts'

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7 // 7日

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- レート制限: IPごと 60回/分 -------------------------------------
  const ip = clientIp(req)
  const { data: allowed } = await admin.rpc('bump_rate_limit', {
    p_bucket: `sharedset:${ip}`,
    p_limit: 60,
    p_window_seconds: 60,
  })
  if (allowed === false) {
    return json({ error: 'RATE_LIMIT' }, 429)
  }

  // トークンの形が違う時点で打ち切る（DB問い合わせをさせない）
  if (!/^[A-Za-z0-9_-]{21}$/.test(token)) {
    return json({ error: 'NOT_FOUND' }, 404)
  }

  // 完全一致のみ。共有オフ・削除済みは 404 と区別しない。
  const { data: set, error } = await admin
    .from('material_sets')
    .select(
      'id, title, mode, default_display, audio_enabled, show_word_on_answer, games_config, owner_id',
    )
    .eq('share_token', token)
    .eq('share_enabled', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !set) return json({ error: 'NOT_FOUND' }, 404)

  const { data: cards } = await admin
    .from('cards')
    .select('id, word, image_path, pair_image_path, audio_path, sort_order')
    .eq('set_id', set.id)
    .order('sort_order', { ascending: true })

  const paths = [
    ...new Set(
      (cards ?? [])
        .flatMap((c) => [c.image_path, c.pair_image_path, c.audio_path])
        .filter((p): p is string => Boolean(p)),
    ),
  ]

  const urlMap: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from('media')
      .createSignedUrls(paths, SIGNED_URL_TTL_SEC)
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urlMap[item.path] = item.signedUrl
    }
  }

  return json({
    set: {
      title: set.title,
      mode: set.mode,
      defaultDisplay: set.default_display,
      audioEnabled: set.audio_enabled,
      showWordOnAnswer: set.show_word_on_answer,
      gamesConfig: set.games_config,
    },
    cards: (cards ?? []).map((c) => ({
      id: c.id,
      word: c.word,
      imageUrl: c.image_path ? (urlMap[c.image_path] ?? null) : null,
      pairImageUrl: c.pair_image_path ? (urlMap[c.pair_image_path] ?? null) : null,
      audioUrl: c.audio_path ? (urlMap[c.audio_path] ?? null) : null,
      sortOrder: c.sort_order,
    })),
  })
})
