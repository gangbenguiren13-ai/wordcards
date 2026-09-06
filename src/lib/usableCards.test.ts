import { describe, expect, it } from 'vitest'
import { needsImage, needsWord, selectUsableCards } from './usableCards'
import type { Card } from '@/types'

function card(over: Partial<Card>): Card {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    set_id: 's',
    word: over.word ?? 'dog',
    image_path: over.image_path === undefined ? 'o/s/c/image.webp' : over.image_path,
    pair_image_path: null,
    audio_path: over.audio_path ?? null,
    audio_source: null,
    sort_order: over.sort_order ?? 0,
    created_at: '',
    updated_at: '',
  }
}

describe('needsWord / needsImage', () => {
  it('画像のみは単語を必要としない', () => {
    expect(needsWord('image_only')).toBe(false)
    expect(needsImage('image_only')).toBe(true)
  })
  it('単語のみは画像を必要としない', () => {
    expect(needsWord('word_only')).toBe(true)
    expect(needsImage('word_only')).toBe(false)
  })
  it('表裏モードは両方必要', () => {
    expect(needsWord('front_image_back_word')).toBe(true)
    expect(needsImage('front_image_back_word')).toBe(true)
  })
})

describe('selectUsableCards', () => {
  it('揃っていれば全部使える', () => {
    const r = selectUsableCards([card({ word: 'dog' }), card({ word: 'cat' })], 'word_image')
    expect(r.usable).toHaveLength(2)
    expect(r.excluded).toHaveLength(0)
    expect(r.reason).toBeNull()
  })

  it('画像のみモードでは単語が空でも使える', () => {
    const r = selectUsableCards([card({ word: '  ' })], 'image_only')
    expect(r.usable).toHaveLength(1)
  })

  it('画像のみモードで画像がないカードは外れる', () => {
    const r = selectUsableCards([card({ image_path: null })], 'image_only')
    expect(r.usable).toHaveLength(0)
    expect(r.reason).toContain('画像がない1枚')
  })

  it('単語のみモードでは画像がなくても使える', () => {
    const r = selectUsableCards([card({ image_path: null })], 'word_only')
    expect(r.usable).toHaveLength(1)
  })

  it('単語＋画像モードは欠けたほうを両方報告する', () => {
    const r = selectUsableCards(
      [card({ word: 'ok' }), card({ image_path: null }), card({ word: '' })],
      'word_image',
    )
    expect(r.usable).toHaveLength(1)
    expect(r.excluded).toHaveLength(2)
    expect(r.reason).toContain('画像がない1枚')
    expect(r.reason).toContain('単語がない1枚')
  })

  it('元の並び順を保つ', () => {
    const a = card({ id: 'a', word: 'a' })
    const b = card({ id: 'b', word: 'b' })
    const c = card({ id: 'c', word: 'c' })
    const r = selectUsableCards([a, b, c], 'word_image')
    expect(r.usable.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})
