/**
 * 文字列の正規化。
 * 単語の重複判定と、ファイル名⇔単語の自動マッチング（P2）の両方で使う。
 *
 * 手順（計画書 10-1(4) の規則）:
 *   NFC正規化 → 全角英数を半角化 → 小文字化 → 前後空白除去
 */
export function normalizeWord(input: string): string {
  return input
    .normalize('NFKC') // 全角英数・記号を半角へ（NFCも包含）
    .toLowerCase()
    .trim()
}

/**
 * ファイル名から照合キーを作る。
 * 拡張子を除去したうえで normalizeWord を適用する。
 */
export function fileNameToKey(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '')
  return normalizeWord(withoutExt)
}

/**
 * 末尾の連番・括弧・区切り記号を落とした「ゆるいキー」を作る。
 *   dog_01 → dog / dog (1) → dog / dog-2 → dog / dogのコピー → dog
 * 完全一致で見つからなかったときの二段目の照合に使う。
 * 注意: これ以上の曖昧一致（部分一致・類似度）は行わない。
 */
export function looseKey(key: string): string {
  return key
    .replace(/\s*[(（]\s*\d+\s*[)）]\s*$/, '') // 末尾の (1) （2）
    .replace(/\s*のコピー\d*$/, '') // macOS/Windows 日本語の複製
    .replace(/\s*[-_ ]\s*\d+$/, '') // 末尾の -1 _01 " 2"
    .replace(/\s*copy\s*\d*$/, '')
    .trim()
}

/** 拡張子を小文字で返す（ドットなし）。拡張子がなければ空文字。 */
export function extOf(fileName: string): string {
  const m = fileName.match(/\.([^.]+)$/)
  return m ? m[1].toLowerCase() : ''
}
