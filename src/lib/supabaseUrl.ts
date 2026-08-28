/**
 * Supabase の設定画面には「Project URL」のほかに
 * `https://xxxx.supabase.co/rest/v1/` のような別のエンドポイントも表示されている。
 * そちらを貼ってしまう事故が起きやすいので、末尾を取り除いて正規化する。
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/\/+$/, '') // 末尾のスラッシュ
    .replace(/\/rest\/v1$/, '') // REST エンドポイントを貼ってしまった場合
    .replace(/\/auth\/v1$/, '')
    .replace(/\/storage\/v1$/, '')
    .replace(/\/functions\/v1$/, '')
    .replace(/\/+$/, '')
}
