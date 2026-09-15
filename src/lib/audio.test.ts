// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pending: Array<(value: AudioBuffer) => void> = []
const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; buffer: AudioBuffer | null }> = []
const speech = { cancel: vi.fn(), speak: vi.fn() }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); pending.length = 0; sources.length = 0
  class FakeContext {
    state = 'running'
    destination = {}
    decodeAudioData = () => new Promise<AudioBuffer>(resolve => pending.push(resolve))
    createBufferSource() {
      const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), buffer: null }
      sources.push(source)
      return source
    }
  }
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('speechSynthesis', speech)
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
})
afterEach(() => vi.unstubAllGlobals())
describe('音声の中断と連打', () => {
  it('decodeが逆順で終わっても最後に押した音だけ再生する', async () => {
    const { playBuffer } = await import('./audio')
    const first = playBuffer('first', new ArrayBuffer(1))
    const second = playBuffer('second', new ArrayBuffer(2))
    pending[1]({} as AudioBuffer); await second
    pending[0]({} as AudioBuffer); await first
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledOnce()
    expect(sources[0].stop).not.toHaveBeenCalled()
  })
  it('読み込み中に消音・終了すると遅れて再生しない', async () => {
    const { playBuffer, stopPlayback } = await import('./audio')
    const play = playBuffer('first', new ArrayBuffer(1))
    stopPlayback(); pending[0]({} as AudioBuffer); await play
    expect(sources).toHaveLength(0)
  })
  it('音声ファイルから端末読み上げに切り替えると前の音を止める', async () => {
    const { playBuffer, speak } = await import('./audio')
    const play = playBuffer('first', new ArrayBuffer(1))
    pending[0]({} as AudioBuffer); await play
    speak('cat')
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(speech.speak).toHaveBeenCalledOnce()
  })
  it('読み上げに切り替えた後でファイルのdecodeが終わっても割り込まない', async () => {
    const { playBuffer, speak } = await import('./audio')
    const play = playBuffer('first', new ArrayBuffer(1))
    speak('cat'); pending[0]({} as AudioBuffer); await play
    expect(sources).toHaveLength(0)
    expect(speech.speak).toHaveBeenCalledOnce()
  })
  it('読み上げ失敗だけを通知し、意図した中断は失敗にしない', async () => {
    const { speak, stopPlayback } = await import('./audio')
    const onError = vi.fn()
    speak('cat', { onError })
    const utterance = speech.speak.mock.calls[0][0]
    utterance.onerror({ error: 'interrupted' })
    expect(onError).not.toHaveBeenCalled()
    utterance.onerror({ error: 'voice-unavailable' })
    expect(onError).toHaveBeenCalledOnce()
    stopPlayback(); utterance.onerror({ error: 'voice-unavailable' })
    expect(onError).toHaveBeenCalledOnce()
  })
})
