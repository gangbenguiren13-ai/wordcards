/** 教材セットのモード */
export type SetMode = 'elementary' | 'junior'

/** 表示方法（中学校モードで選択。小学校モードは実質 image_only 固定） */
export type DisplayMode =
  | 'word_image'
  | 'word_only'
  | 'image_only'
  | 'front_image_back_word'
  | 'front_word_back_image'

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  word_image: '単語＋画像',
  word_only: '単語のみ',
  image_only: '画像のみ',
  front_image_back_word: '表：画像／裏：単語',
  front_word_back_image: '表：単語／裏：画像',
}

export const SET_MODE_LABELS: Record<SetMode, string> = {
  elementary: '小学校',
  junior: '中学校',
}

/** ゲーム識別子 */
export type GameId =
  | 'flashcards'
  | 'memory'
  | 'slowreveal'
  | 'whatsmissing'
  | 'hiddencard'
  | 'gesture'

/** MVP で実装するゲーム */
export const MVP_GAMES: GameId[] = ['flashcards', 'memory', 'slowreveal']

export interface FlashcardsDefaults {
  order: 'sequential' | 'random'
  advance: 'manual' | 'auto'
  autoSeconds: number
  display: DisplayMode | null
  showProgress: boolean
  audioAutoplay: boolean
  reviewMode: 'mixed' | 'rounds'
}

export interface MemoryDefaults {
  cardCount: 8 | 12 | 16 | 20
  pick: 'sequential' | 'random'
  pairType: 'word_image' | 'word_word' | 'image_image' | 'image_pairimage'
  timeLimitMinutes: number | null
  teams: number
  audioOnMatch: boolean
}

export interface SlowRevealDefaults {
  direction: 'top' | 'bottom' | 'left' | 'right' | 'center'
  steps: number
  advance: 'manual' | 'auto'
  autoSeconds: number
  order: 'sequential' | 'random'
  answerDisplay: 'image' | 'image_word' | 'image_word_audio'
}

export interface GameEntry<D> {
  enabledForStudents: boolean
  defaults: D
  studentAdjustable: string[]
}

/** games_config（未定義のゲームは生徒に非表示） */
export interface GamesConfig {
  flashcards?: GameEntry<FlashcardsDefaults>
  memory?: GameEntry<MemoryDefaults>
  slowreveal?: GameEntry<SlowRevealDefaults>
  /** 第2段階用の予約枠 */
  whatsmissing?: Record<string, unknown>
  hiddencard?: Record<string, unknown>
  gesture?: Record<string, unknown>
}

/** material_sets テーブル 1 行 */
export interface MaterialSet {
  id: string
  owner_id: string
  title: string
  mode: SetMode
  default_display: DisplayMode
  audio_enabled: boolean
  show_word_on_answer: boolean
  games_config: GamesConfig
  share_token: string | null
  share_enabled: boolean
  school_shared: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** cards テーブル 1 行 */
export interface Card {
  id: string
  set_id: string
  word: string
  image_path: string | null
  pair_image_path: string | null
  audio_path: string | null
  /** 'upload' = 先生が登録 / 'generated' = 自動生成（将来用） */
  audio_source: 'upload' | 'generated' | null
  sort_order: number
  created_at: string
  updated_at: string
}

/** 一覧表示用（カード枚数付き） */
export interface MaterialSetSummary extends MaterialSet {
  card_count: number
  first_image_path: string | null
}
