import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from './supabaseUrl'

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error(
    '[WordCards] 環境変数 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。' +
      ' Cloudflare の Settings > Builds > Variables and secrets を確認してください。',
  )
}

/**
 * anon キーはブラウザに埋め込まれる公開鍵。
 * データの保護は RLS（Row Level Security）と Edge Function が担う。
 * 秘密鍵（service_role）は絶対にここに置かない。
 *
 * 未設定でも createClient が例外を投げて画面が真っ白にならないよう、
 * ダミー値でクライアントを作る（画面には設定不足の警告が出る）。
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** Edge Function のURLを組み立てる */
export function functionUrl(name: string): string {
  return `${url}/functions/v1/${name}`
}
