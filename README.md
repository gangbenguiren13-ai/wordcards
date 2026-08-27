# WordCards

小・中学校の英語授業で使う、フラッシュカード兼ミニゲームWebアプリ。

- 教師が単語・画像・音声を登録すると、教室の大型画面と生徒のiPadの両方で使える
- 教科書が改訂されても、教材データの差し替えだけで継続利用できる
- 教科書由来の画像を扱うため、**画像・音声は非公開ストレージ＋署名付きURL**で配信する

**セットアップは [docs/導入手順.md](docs/導入手順.md) を読んでください。** ブラウザの操作だけで完了します。

## 現在の実装状況

| フェーズ | 内容 | 状態 |
|---------|------|------|
| P0 | 環境構築・DBスキーマ・RLS・CI | ✅ 完了 |
| P1 | 認証（招待コード）・教材管理・画像圧縮・音声登録・バリデーション | ✅ 完了 |
| P2 | 一括登録（表形式・CSV・ファイル名自動マッチング）・JSON/ZIP入出力 | ⬜ 未着手 |
| P3 | 共有URL・QR・生徒アクセス・プリロード | ⬜ 未着手 |
| P4 | フラッシュカード（要復習・音声再生） | ⬜ 未着手 |
| P5 | 神経衰弱・Slow Reveal | ⬜ 未着手 |
| P6 | プレビュー・エラー画面・QA | ⬜ 未着手 |

第2段階（What's Missing / Hidden Card / ジェスチャー / 参加コード / 校内共有 / PWA）は
[docs/開発計画書.md](docs/開発計画書.md) の §4 を参照。

## 技術構成

| 層 | 採用 |
|----|------|
| フロントエンド | React 19 + Vite 8 + TypeScript + Tailwind CSS v4 |
| 状態管理 | TanStack Query（サーバー状態）/ Zustand（ゲーム状態・P4以降） |
| ホスティング | Cloudflare Pages |
| バックエンド | Supabase（Auth / Postgres + RLS / 非公開Storage / Edge Functions） |

### 計画書からの変更点

計画書は React 18 / Tailwind v3 を想定していたが、着手時点（2026-08）の最新安定版に合わせて
**React 19 / Vite 8 / Tailwind v4** を採用した。Tailwind v4 は設定ファイルではなく
CSS 内の `@theme` でトークンを定義する方式のため、`tailwind.config.js` は存在しない
（`src/styles/index.css` を参照）。

カードの並べ替えは、計画書ではドラッグ＆ドロップと記載されていたが、
**iPadのタッチ操作での確実性を優先して ↑↓ ボタン方式で実装した**。
`A→Z` と `シャッフルして固定` は計画どおり。ドラッグ＆ドロップはP2以降の改善項目とする。

## 開発コマンド

```bash
npm install
npm run dev        # 開発サーバー（.env が必要。.env.example をコピーして使う）
npm test           # 単体テスト
npm run typecheck  # 型チェック
npm run lint       # 静的解析
npm run build      # 本番ビルド
```

## ディレクトリ構成

```
src/
├─ api/          Supabase へのアクセス（sets / cards / 署名付きURL）
├─ auth/         認証コンテキストとルートガード
├─ components/   共通UI（ui/ 配下がプリミティブ）
├─ games/        ゲーム実装（P4以降）
├─ lib/          純粋ロジック（正規化・バリデーション・画像圧縮・Storage抽象化）
├─ pages/        画面（teacher/ と student/）
├─ styles/       Tailwind のトークン定義
└─ types/        ドメイン型

supabase/
├─ migrations/   DBスキーマ・RLS・Storage ポリシー
├─ setup/        SQL Editor に貼るだけの all-in-one.sql
└─ functions/    Edge Functions（signup / shared-set / purge-trash）
```

## 設計上の約束（実装時に崩さないこと）

1. **画像・音声を公開URLで配信しない。** 保管庫は非公開のまま、署名付きURLでのみ配信する。
2. **生徒用画面（`/p/*`）から管理画面への導線を置かない。** リンク1本でも要件違反。
3. **教材の共有を localStorage で代替しない。** 別端末から開けることが要件。
4. **生徒の個人情報を保存しない。** 得点・要復習はメモリ内のみ。
5. **メディアへのアクセスは `lib/mediaStore.ts` 経由に限る。** 将来のR2移行のため。

## 無料枠の確認記録

| サービス | 確認日 | 内容 |
|---------|--------|------|
| Supabase Free | （初回セットアップ時に記入） | DB / Storage / 転送量 |
| Cloudflare Pages Free | （初回セットアップ時に記入） | ビルド回数 / 転送量 |

Supabase の無料プロジェクトは一定期間アクセスがないと一時停止するため、
`.github/workflows/keepalive.yml` が週2回 ping を送っている。
