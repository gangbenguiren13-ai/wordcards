/** データ仕様書 §9 のバリデーション定数を一元管理する。 */

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const
export const AUDIO_EXTENSIONS = ['mp3', 'm4a'] as const

export const IMAGE_MIME_HINTS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]
export const AUDIO_MIME_HINTS = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a']

/** 元画像の受け入れ上限（圧縮前） */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
/** 音声の上限（変換しないためそのまま保存される） */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024 // 2MB

/** 圧縮設定 */
export const IMAGE_MAX_EDGE = 1200
export const IMAGE_QUALITY = 0.8
/** これを超えたら品質を落として再圧縮する目標値 */
export const IMAGE_TARGET_BYTES = 300 * 1024

export const WORD_MIN = 1
export const WORD_MAX = 50
export const TITLE_MIN = 1
export const TITLE_MAX = 60

/** 1セットあたりのカード枚数 */
export const CARDS_HARD_LIMIT = 200
export const CARDS_WARN_LIMIT = 120

/** 1教師あたりのセット数（ソフト上限・警告のみ） */
export const SETS_WARN_LIMIT = 100

/** 署名付きURLの有効期限（秒）= 7日 */
export const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

/** ゴミ箱の保持日数 */
export const TRASH_RETENTION_DAYS = 30

/** 共有トークンの長さ（nanoid） */
export const SHARE_TOKEN_LENGTH = 21

/** ネットワークのタイムアウト */
export const NETWORK_TIMEOUT_MS = 15000

/** ゲーム設定の範囲 */
export const MEMORY_CARD_COUNTS = [8, 12, 16, 20] as const
export const SLOWREVEAL_STEPS_MIN = 4
export const SLOWREVEAL_STEPS_MAX = 12
export const SLOWREVEAL_STEPS_DEFAULT = 8
export const AUTO_SECONDS_MIN = 1
export const AUTO_SECONDS_MAX = 10
