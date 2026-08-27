import { useRef, useState } from 'react'
import type { Card } from '@/types'
import { Button } from '@/components/ui'
import { checkUploadFile, formatBytes, type Issue } from '@/lib/validation'

interface Props {
  card: Card
  index: number
  total: number
  imageUrl?: string
  audioUrl?: string
  busy?: boolean
  onWordChange: (word: string) => void
  onPickImage: (file: File) => void
  onPickAudio: (file: File) => void
  onRemoveImage: () => void
  onRemoveAudio: () => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onFileRejected: (issue: Issue) => void
}

export function CardRow({
  card,
  index,
  total,
  imageUrl,
  audioUrl,
  busy,
  onWordChange,
  onPickImage,
  onPickAudio,
  onRemoveImage,
  onRemoveAudio,
  onMove,
  onDelete,
  onFileRejected,
}: Props) {
  const imageInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const [word, setWord] = useState(card.word)

  function handleFile(file: File | undefined, kind: 'image' | 'audio') {
    if (!file) return
    const issue = checkUploadFile(file, kind)
    if (issue) {
      onFileRejected(issue)
      return
    }
    if (kind === 'image') onPickImage(file)
    else onPickAudio(file)
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border-2 border-line bg-surface p-3">
      <span className="w-6 shrink-0 text-center text-sm font-bold text-ink-soft">
        {index + 1}
      </span>

      {/* サムネイル */}
      <button
        type="button"
        onClick={() => imageInput.current?.click()}
        disabled={busy}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-line bg-canvas"
        aria-label={imageUrl ? '画像を変える' : '画像を選ぶ'}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-ink-soft">
            ＋
          </span>
        )}
      </button>
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0], 'image')
          e.target.value = ''
        }}
      />

      {/* 単語 */}
      <div className="min-w-0 flex-1">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onBlur={() => word !== card.word && onWordChange(word.trim())}
          maxLength={50}
          placeholder="単語"
          aria-label={`${index + 1}枚目の単語`}
          className="min-h-11 w-full rounded-lg border-2 border-line bg-surface px-3 text-base focus:border-brand-500"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {!card.image_path && (
            <span className="font-bold text-warn-700">！ 画像なし</span>
          )}
          {card.audio_path ? (
            <span className="inline-flex items-center gap-1 font-bold text-ok-700">
              🔊 音声あり
              <button
                type="button"
                onClick={onRemoveAudio}
                className="underline"
                disabled={busy}
              >
                外す
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => audioInput.current?.click()}
              className="font-bold text-brand-600 underline"
              disabled={busy}
            >
              ＋ 音声をつける
            </button>
          )}
          {card.image_path && (
            <button
              type="button"
              onClick={onRemoveImage}
              className="text-ink-soft underline"
              disabled={busy}
            >
              画像を外す
            </button>
          )}
        </div>
        {audioUrl && (
          <audio src={audioUrl} controls preload="none" className="mt-1 h-8 w-full max-w-56" />
        )}
      </div>
      <input
        ref={audioInput}
        type="file"
        accept=".mp3,.m4a,audio/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0], 'audio')
          e.target.value = ''
        }}
      />

      {/* 並べ替え・削除 */}
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0 || busy}
          aria-label="上へ移動"
          className="h-8 w-11 rounded-lg border-2 border-line font-bold disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1 || busy}
          aria-label="下へ移動"
          className="h-8 w-11 rounded-lg border-2 border-line font-bold disabled:opacity-30"
        >
          ↓
        </button>
      </div>
      <Button variant="danger" onClick={onDelete} disabled={busy} aria-label="このカードを削除">
        ✕
      </Button>
    </li>
  )
}

export { formatBytes }
