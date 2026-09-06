/**
 * サーバーからのエラーを、教師が読んで次に何をすればよいか分かる日本語にする。
 * 英語の技術メッセージをそのまま出すと、そこで手が止まってしまう。
 */
export function toJapaneseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const lower = raw.toLowerCase()

  if (!navigator.onLine) return 'ネットにつながっていません。通信を確認してください。'
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('abort'))
    return '通信できませんでした。少し待ってからもう一度お試しください。'
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('401'))
    return 'ログインの有効期限が切れました。もう一度ログインしてください。'
  if (lower.includes('row-level security') || lower.includes('permission') || lower.includes('403'))
    return 'この操作をする権限がありません。自分が作った教材か確認してください。'
  if (lower.includes('duplicate') || lower.includes('unique'))
    return 'すでに同じものが登録されています。'
  if (lower.includes('violates check constraint') || lower.includes('check constraint'))
    return '入力の内容が保存できる形になっていません。文字数などを確認してください。'
  if (lower.includes('payload') || lower.includes('too large'))
    return 'ファイルが大きすぎます。'
  if (raw.trim().length === 0) return '処理に失敗しました。もう一度お試しください。'
  return `処理に失敗しました：${raw}`
}
