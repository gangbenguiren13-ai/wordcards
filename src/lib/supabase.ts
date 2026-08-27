import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // ビルドは通るが起動時に気づけるようにする
  console.error(
    '[WordCards] 環境変数 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。' +
      ' .env ファイル（またはCloudflare Pagesの環境変数）を確認してください。',
  )
}

/**
 * anon キーはブラウザに埋め込まれる公開鍵。
 * データの保護は RLS（Row Level Security）とEdge Functionが担う。
 * 秘密鍵（service_role）は絶対にここに置かない。
 */
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Edge Function のURLを組み立てる */
export function functionUrl(name: string): string {
  return `${url}/functions/v1/${name}`
}
