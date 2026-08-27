import { describe, expect, it } from 'vitest'
import { extOf, fileNameToKey, looseKey, normalizeWord } from './normalize'

describe('normalizeWord', () => {
  it('大文字小文字と前後空白を無視する', () => {
    expect(normalizeWord('  Dog ')).toBe('dog')
    expect(normalizeWord('DOG')).toBe(normalizeWord('dog'))
  })

  it('全角英数を半角にそろえる', () => {
    expect(normalizeWord('ｄｏｇ')).toBe('dog')
    expect(normalizeWord('ＤＯＧ')).toBe('dog')
  })
})

describe('fileNameToKey', () => {
  it('拡張子を落として正規化する', () => {
    expect(fileNameToKey('Dog.JPG')).toBe('dog')
    expect(fileNameToKey('cat.jpeg')).toBe('cat')
  })

  it('ドットを含む名前でも最後の拡張子だけ落とす', () => {
    expect(fileNameToKey('unit1.dog.png')).toBe('unit1.dog')
  })
})

describe('looseKey', () => {
  it('末尾の連番を落とす', () => {
    expect(looseKey('dog_01')).toBe('dog')
    expect(looseKey('dog-2')).toBe('dog')
    expect(looseKey('dog 3')).toBe('dog')
  })

  it('括弧つきの連番を落とす', () => {
    expect(looseKey('dog (1)')).toBe('dog')
    expect(looseKey('dog（2）')).toBe('dog')
  })

  it('複製サフィックスを落とす', () => {
    expect(looseKey('dogのコピー')).toBe('dog')
    expect(looseKey('dog copy 2')).toBe('dog')
  })

  it('単語の一部である数字は残す（誤マッチ防止）', () => {
    expect(looseKey('unit1')).toBe('unit1')
  })
})

describe('extOf', () => {
  it('小文字の拡張子を返す', () => {
    expect(extOf('a.PNG')).toBe('png')
    expect(extOf('noext')).toBe('')
  })
})
