import { describe, expect, it } from 'vitest'
import { decodeTable, draftRow, existingRows, matchFiles, parseTable, rowError, wordsFromFiles } from './bulkImport'
import type { Card } from '@/types'

describe('表とCSVの読み取り', () => {
  it('BOM・列順・引用符・カンマを保ち、順序指定で並べる', () => {
    const rows = parseTable('\uFEFFsort_order,word,ignored,image_file\r\n2,"say ""hello"", please",x,hello.png\r\n1,cat,x,cat.png\r\n')
    expect(rows.map(r => r.word)).toEqual(['cat', 'say "hello", please'])
    expect(rows[1].expected.image).toBe('hello.png')
  })
  it('タブ区切りを自動判定する', () => expect(parseTable('word\taudio_file\ncat\tcat.mp3')[0].expected.audio).toBe('cat.mp3'))
  it('Shift_JISの日本語を文字化けさせない', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('word\r\n'), 0x94, 0x4c]) // 猫
    const result = decodeTable(bytes)
    expect(result.encoding).toBe('Shift_JIS'); expect(parseTable(result.text)[0].word).toBe('猫')
    expect(decodeTable(new TextEncoder().encode('word\n犬')).encoding).toBe('UTF-8')
  })
  it.each(['cat,dog', 'word,word\ncat,dog', 'word\n"unclosed', `word\n${Array(201).fill('cat').join('\n')}`])('壊れた表・ヘッダ・上限超を拒否する', input => expect(() => parseTable(input)).toThrow())
  it('不正行は個別に示し、重複単語は保存不可にしない', () => {
    const rows = parseTable('word,sort_order\ncat,1\ncat,2\n,3\ndog,no\nbird,4,extra')
    expect(rowError(rows[0])).toBeUndefined(); expect(rowError(rows[1])).toBeUndefined()
    expect(rows.filter(r => rowError(r))).toHaveLength(3)
    expect(rowError(draftRow('x'.repeat(51)))).toContain('50')
  })
})
describe('ファイル名の対応', () => {
  const file = (name: string) => new File(['fake'], name)
  it('dog・catは一致し、dog2は勝手にdogへ寄せない', () => {
    const result = matchFiles([draftRow('dog'), draftRow('cat')], ['dog.jpg', 'cat.jpg', 'dog2.jpg'].map(file))
    expect(result.rows.map(r => r.files.image?.name)).toEqual(['dog.jpg', 'cat.jpg'])
    expect(result.pending.map(p => p.file.name)).toEqual(['dog2.jpg'])
  })
  it('全角・大小文字・連番の既定規則で照合する', () => {
    const result = matchFiles([draftRow('ＤＯＧ'), draftRow('cat')], ['dog (1).jpg', 'CAT.MP3'].map(file))
    expect(result.pending).toHaveLength(0); expect(result.rows[1].files.audio?.name).toBe('CAT.MP3')
  })
  it('同じ単語の2画像や重複した単語は手動確認へ回す', () => {
    expect(matchFiles([draftRow('dog')], ['dog.jpg', 'dog_01.png'].map(file)).pending).toHaveLength(2)
    expect(matchFiles([draftRow('dog'), draftRow('Dog')], [file('dog.jpg')]).pending).toHaveLength(1)
  })
  it('CSVの明示した関連画像・音声を優先し、別の名前は割り当てない', () => {
    const rows = parseTable('word,image_file,pair_image_file,audio_file\ndog,animal.jpg,house.jpg,voice.mp3')
    const result = matchFiles(rows, ['dog.jpg', 'house.jpg', 'voice.mp3'].map(file))
    expect(result.rows[0].files.image).toBeUndefined()
    expect(result.rows[0].files.pairImage?.name).toBe('house.jpg')
    expect(result.rows[0].files.audio?.name).toBe('voice.mp3')
    expect(result.pending).toHaveLength(1)
  })
  it('登録済みの画像は自動で置き換えない', () => {
    const rows = existingRows([{ id: 'c', word: 'dog', image_path: 'old', sort_order: 0 } as Card])
    expect(matchFiles(rows, [file('dog.jpg')]).pending).toHaveLength(1)
  })
  it('未対応ファイルから同じ名前の画像と音声を1単語にまとめる', () => {
    const files = ['cat.jpg', 'cat.mp3', 'script.svg'].map(file)
    const rows = wordsFromFiles([], files)
    expect(rows.map(r => r.word)).toEqual(['cat'])
    const result = matchFiles(rows, files)
    expect(result.rows[0].files.audio?.name).toBe('cat.mp3')
    expect(result.pending[0].reason).toContain('対応していない')
  })
})
