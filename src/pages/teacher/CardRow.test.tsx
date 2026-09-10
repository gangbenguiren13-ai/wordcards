// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CardRow } from './CardRow'
import type { Card } from '@/types'
afterEach(cleanup)
it('関連画像を画像として検査し、通常画像と別の登録先へ渡す', () => {
  const pair = vi.fn(), image = vi.fn(), rejected = vi.fn()
  const card: Card = { id: 'a', set_id: 's', word: 'cat', image_path: null, pair_image_path: null, audio_path: null, audio_source: null, sort_order: 0, created_at: '', updated_at: '' }
  const { container } = render(<CardRow card={card} index={0} total={1} onWordChange={vi.fn()} onPickImage={image} onPickAudio={vi.fn()} onRemoveImage={vi.fn()} onRemoveAudio={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} onFileRejected={rejected} onPickPair={pair} />)
  const input = container.querySelector('details input')!
  const valid = new File(['x'], 'pair.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [valid] } })
  expect(pair).toHaveBeenCalledWith(valid); expect(image).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] } })
  expect(rejected).toHaveBeenCalledTimes(1); expect(pair).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('1枚目の単語'), { target: { value: 'caterpillar' } })
  expect((screen.getByLabelText('1枚目の単語') as HTMLInputElement).value).toBe('caterpillar')
})
