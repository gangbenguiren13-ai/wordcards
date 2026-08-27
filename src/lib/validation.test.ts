import { describe, expect, it } from 'vitest'
import { checkUploadFile, hasBlockingError, validateSet } from './validation'
import { defaultGamesConfig } from './gameDefaults'
import { MAX_AUDIO_BYTES, MAX_IMAGE_BYTES } from './constants'

function file(name: string, size: number, type = ''): File {
  const blob = new Blob([new Uint8Array(0)], { type })
  const f = new File([blob], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function card(over: Partial<{ id: string; word: string; image_path: string | null; pair_image_path: string | null }> = {}) {
  return {
    id: over.id ?? crypto.randomUUID(),
    word: over.word ?? 'dog',
    image_path: over.image_path === undefined ? 'o/s/c/image.webp' : over.image_path,
    pair_image_path: over.pair_image_path ?? null,
  }
}

describe('checkUploadFile', () => {
  it('対応外の画像形式はエラー', () => {
    const issue = checkUploadFile(file('a.gif', 100), 'image')
    expect(issue?.code).toBe('UNSUPPORTED_FORMAT')
    expect(issue?.level).toBe('error')
  })

  it('対応形式はエラーにならない', () => {
    expect(checkUploadFile(file('a.jpg', 100), 'image')).toBeNull()
    expect(checkUploadFile(file('a.HEIC', 100), 'image')).toBeNull()
    expect(checkUploadFile(file('a.mp3', 100), 'audio')).toBeNull()
  })

  it('画像の上限超えはエラー', () => {
    const issue = checkUploadFile(file('big.jpg', MAX_IMAGE_BYTES + 1), 'image')
    expect(issue?.code).toBe('FILE_TOO_LARGE')
  })

  it('音声の上限超えはエラー', () => {
    const issue = checkUploadFile(file('big.mp3', MAX_AUDIO_BYTES + 1), 'audio')
    expect(issue?.code).toBe('FILE_TOO_LARGE')
  })

  it('音声形式に画像を渡すとエラー', () => {
    expect(checkUploadFile(file('a.jpg', 100), 'audio')?.code).toBe('UNSUPPORTED_FORMAT')
  })
})

describe('validateSet', () => {
  const config = defaultGamesConfig('junior')

  it('問題がなければ指摘なし', () => {
    const issues = validateSet({
      title: 'どうぶつ',
      mode: 'junior',
      gamesConfig: config,
      cards: [card({ word: 'dog' }), card({ word: 'cat', image_path: 'o/s/c2/image.webp' })],
    })
    expect(issues).toEqual([])
  })

  it('単語が空ならエラー（保存不可）', () => {
    const issues = validateSet({
      title: 'x',
      mode: 'junior',
      gamesConfig: config,
      cards: [card({ word: '  ' })],
    })
    expect(issues.some((i) => i.code === 'WORD_EMPTY' && i.level === 'error')).toBe(true)
    expect(hasBlockingError(issues)).toBe(true)
  })

  it('画像がないカードは警告（保存は可能）', () => {
    const issues = validateSet({
      title: 'x',
      mode: 'junior',
      gamesConfig: config,
      cards: [card({ word: 'dog', image_path: null })],
    })
    expect(issues.some((i) => i.code === 'IMAGE_MISSING' && i.level === 'warning')).toBe(true)
    expect(hasBlockingError(issues)).toBe(false)
  })

  it('単語の重複を大文字小文字を無視して検出する', () => {
    const issues = validateSet({
      title: 'x',
      mode: 'junior',
      gamesConfig: config,
      cards: [card({ word: 'Dog' }), card({ word: 'dog', image_path: 'o/s/c2/image.webp' })],
    })
    expect(issues.some((i) => i.code === 'WORD_DUPLICATED')).toBe(true)
  })

  it('同じ画像の使い回しを検出する', () => {
    const issues = validateSet({
      title: 'x',
      mode: 'junior',
      gamesConfig: config,
      cards: [card({ word: 'dog' }), card({ word: 'cat' })],
    })
    expect(issues.some((i) => i.code === 'IMAGE_REUSED')).toBe(true)
  })

  it('未対応ファイルが残っていれば警告する', () => {
    const issues = validateSet({
      title: 'x',
      mode: 'junior',
      gamesConfig: config,
      cards: [card()],
      unmatchedFiles: ['zebra.png'],
    })
    expect(issues.some((i) => i.code === 'UNMATCHED_FILE' && i.fileName === 'zebra.png')).toBe(true)
  })

  it('セット名が長すぎるとエラー', () => {
    const issues = validateSet({
      title: 'あ'.repeat(61),
      mode: 'junior',
      gamesConfig: config,
      cards: [card()],
    })
    expect(issues.some((i) => i.code === 'TITLE_LENGTH' && i.level === 'error')).toBe(true)
  })

  it('カード上限を超えるとエラー', () => {
    const many = Array.from({ length: 201 }, (_, i) =>
      card({ word: `w${i}`, image_path: `o/s/c${i}/image.webp` }),
    )
    const issues = validateSet({ title: 'x', mode: 'junior', gamesConfig: config, cards: many })
    expect(issues.some((i) => i.code === 'CARD_LIMIT_EXCEEDED' && i.level === 'error')).toBe(true)
  })
})
