import {
  AUDIO_EXTENSIONS,
  CARDS_HARD_LIMIT,
  CARDS_WARN_LIMIT,
  IMAGE_EXTENSIONS,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  TITLE_MAX,
  TITLE_MIN,
  WORD_MAX,
} from './constants'
import { extOf, normalizeWord } from './normalize'
import type { Card, GamesConfig, MaterialSet } from '@/types'

/**
 * 計画書 10-4 の区分:
 *   error   … 保存を止める
 *   warning … 保存はできるが警告パネルに残り続ける
 */
export type IssueLevel = 'error' | 'warning'

export type IssueCode =
  | 'WORD_EMPTY'
  | 'WORD_TOO_LONG'
  | 'TITLE_LENGTH'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'CARD_LIMIT_EXCEEDED'
  | 'IMAGE_MISSING'
  | 'WORD_DUPLICATED'
  | 'IMAGE_REUSED'
  | 'UNMATCHED_FILE'
  | 'UNMATCHED_WORD'
  | 'CARD_COUNT_WARN'
  | 'GAME_NEEDS_IMAGE'

export interface Issue {
  level: IssueLevel
  code: IssueCode
  message: string
  /** 該当カードID（カード単位の指摘のとき） */
  cardId?: string
  /** 該当ファイル名（一括登録の指摘のとき） */
  fileName?: string
}

/** 保存をブロックすべきかどうか */
export function hasBlockingError(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

/* ------------------------------------------------------------------ *
 * ファイル単位の検査（アップロード時）
 * ------------------------------------------------------------------ */

export type FileKind = 'image' | 'audio'

export function checkUploadFile(file: File, kind: FileKind): Issue | null {
  const ext = extOf(file.name)
  const allowed: readonly string[] =
    kind === 'image' ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS
  if (!allowed.includes(ext)) {
    return {
      level: 'error',
      code: 'UNSUPPORTED_FORMAT',
      fileName: file.name,
      message:
        kind === 'image'
          ? `「${file.name}」は対応していない画像形式です（対応: ${IMAGE_EXTENSIONS.join(', ')}）`
          : `「${file.name}」は対応していない音声形式です（対応: ${AUDIO_EXTENSIONS.join(', ')}）`,
    }
  }
  const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (file.size > max) {
    return {
      level: 'error',
      code: 'FILE_TOO_LARGE',
      fileName: file.name,
      message: `「${file.name}」は${formatBytes(file.size)}あり、上限${formatBytes(max)}を超えています`,
    }
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/* ------------------------------------------------------------------ *
 * セット単位の検査（保存時・警告パネル用）
 * ------------------------------------------------------------------ */

export interface ValidateSetInput {
  title: string
  mode: MaterialSet['mode']
  gamesConfig: GamesConfig
  cards: Pick<Card, 'id' | 'word' | 'image_path' | 'pair_image_path'>[]
  /** 一括登録で対応先が決まらずに残っているファイル名 */
  unmatchedFiles?: string[]
}

export function validateSet(input: ValidateSetInput): Issue[] {
  const issues: Issue[] = []
  const { title, cards, gamesConfig, unmatchedFiles = [] } = input

  // --- セット名 -----------------------------------------------------
  const trimmedTitle = title.trim()
  if (trimmedTitle.length < TITLE_MIN || trimmedTitle.length > TITLE_MAX) {
    issues.push({
      level: 'error',
      code: 'TITLE_LENGTH',
      message: `教材セット名は${TITLE_MIN}〜${TITLE_MAX}文字で入力してください`,
    })
  }

  // --- カード枚数 ---------------------------------------------------
  if (cards.length > CARDS_HARD_LIMIT) {
    issues.push({
      level: 'error',
      code: 'CARD_LIMIT_EXCEEDED',
      message: `カードは${CARDS_HARD_LIMIT}枚までです（現在${cards.length}枚）。セットを分けてください`,
    })
  } else if (cards.length > CARDS_WARN_LIMIT) {
    issues.push({
      level: 'warning',
      code: 'CARD_COUNT_WARN',
      message: `カードが${cards.length}枚あります。${CARDS_WARN_LIMIT}枚を超えると読み込みに時間がかかることがあります`,
    })
  }

  // --- カードごとの検査 ---------------------------------------------
  const wordSeen = new Map<string, string[]>() // 正規化語 -> cardIds
  const imageSeen = new Map<string, string[]>() // image_path -> cardIds

  for (const card of cards) {
    const word = card.word.trim()
    if (word.length === 0) {
      issues.push({
        level: 'error',
        code: 'WORD_EMPTY',
        cardId: card.id,
        message: '単語が入力されていないカードがあります',
      })
    } else if (word.length > WORD_MAX) {
      issues.push({
        level: 'error',
        code: 'WORD_TOO_LONG',
        cardId: card.id,
        message: `「${word.slice(0, 12)}…」は${WORD_MAX}文字を超えています`,
      })
    } else {
      const key = normalizeWord(word)
      wordSeen.set(key, [...(wordSeen.get(key) ?? []), card.id])
    }

    if (!card.image_path) {
      issues.push({
        level: 'warning',
        code: 'IMAGE_MISSING',
        cardId: card.id,
        message: `「${word || '（単語なし）'}」に画像が登録されていません`,
      })
    } else {
      imageSeen.set(card.image_path, [
        ...(imageSeen.get(card.image_path) ?? []),
        card.id,
      ])
    }
  }

  for (const [key, ids] of wordSeen) {
    if (ids.length > 1) {
      issues.push({
        level: 'warning',
        code: 'WORD_DUPLICATED',
        cardId: ids[1],
        message: `「${key}」が${ids.length}枚のカードで重複しています`,
      })
    }
  }
  for (const [path, ids] of imageSeen) {
    if (ids.length > 1) {
      issues.push({
        level: 'warning',
        code: 'IMAGE_REUSED',
        cardId: ids[1],
        message: `同じ画像が${ids.length}枚のカードで使われています（${path.split('/').pop()}）`,
      })
    }
  }

  // --- 未対応ファイル -----------------------------------------------
  for (const fileName of unmatchedFiles) {
    issues.push({
      level: 'warning',
      code: 'UNMATCHED_FILE',
      fileName,
      message: `「${fileName}」はどの単語にも対応づけられていません`,
    })
  }

  // --- ゲーム設定との整合 -------------------------------------------
  const cardsWithoutImage = cards.filter((c) => !c.image_path).length
  if (cardsWithoutImage > 0) {
    const needsImage = gameNeedsImage(gamesConfig)
    if (needsImage) {
      issues.push({
        level: 'warning',
        code: 'GAME_NEEDS_IMAGE',
        message: `画像を使うゲームが有効ですが、画像のないカードが${cardsWithoutImage}枚あります。生徒の画面では自動的に飛ばされます`,
      })
    }
  }

  // 神経衰弱「関連画像同士」を選んでいるのに pair_image がない
  if (gamesConfig.memory?.defaults.pairType === 'image_pairimage') {
    const missing = cards.filter((c) => !c.pair_image_path).length
    if (missing > 0) {
      issues.push({
        level: 'warning',
        code: 'UNMATCHED_WORD',
        message: `神経衰弱の「関連画像どうし」を選んでいますが、関連画像のないカードが${missing}枚あります`,
      })
    }
  }

  return issues
}

function gameNeedsImage(config: GamesConfig): boolean {
  if (config.slowreveal) return true
  if (config.memory) {
    const t = config.memory.defaults.pairType
    if (t !== 'word_word') return true
  }
  if (config.flashcards) {
    const d = config.flashcards.defaults.display
    if (d !== 'word_only') return true
  }
  return false
}
