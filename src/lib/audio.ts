/**
 * 音声まわりの共通処理。
 *
 * iPad Safari には3つの壁がある。
 *  1. ユーザー操作を起点にしないと音が鳴らない → 開始ボタンで一度アンロックする
 *  2. 消音スイッチを入れていると Web Audio が無音になる → audioSession で用途を宣言する
 *  3. 端末の音声合成は最初 getVoices() が空を返す → イベントを待つ
 *
 * 音声ファイルが登録されていないカードのために、端末の音声合成でも読める道を残す。
 * 小学校モードでは文字を見せないので、音が出ないと確認の手段が教師の発声だけになる。
 */

let ctx: AudioContext | null = null
let unlocked = false

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

/**
 * ユーザー操作の中から呼ぶこと（開始ボタンのハンドラなど）。
 * 無音を一度鳴らして再生権を得ておくと、以降カード表示時の自動再生が通る。
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return

  // 消音スイッチが入っていても鳴らせるよう、用途を「再生」と宣言する（Safari独自）
  const nav = navigator as unknown as { audioSession?: { type: string } }
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback'
    } catch {
      // 対応していない環境では黙って諦める
    }
  }

  const c = audioContext()
  if (!c) return
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      return
    }
  }
  const buffer = c.createBuffer(1, 1, 22050)
  const source = c.createBufferSource()
  source.buffer = buffer
  source.connect(c.destination)
  source.start(0)

  // 音声合成のほうも、最初の一声を空で流して初期化しておく
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* noop */
    }
  }
  unlocked = true
}

export function isUnlocked(): boolean {
  return unlocked
}

/* ------------------------------------------------------------------ *
 * 音声ファイルの再生（プリロード済みの ArrayBuffer から）
 * ------------------------------------------------------------------ */

const decoded = new Map<string, AudioBuffer>()
let current: AudioBufferSourceNode | null = null
let playbackVersion = 0

export async function playBuffer(key: string, data: ArrayBuffer): Promise<void> {
  stopPlayback()
  const request = playbackVersion
  const c = audioContext()
  if (!c) throw new Error('Audio playback is unavailable')
  if (c.state === 'suspended') await c.resume()
  if (request !== playbackVersion) return

  let buf = decoded.get(key)
  if (!buf) {
    // decodeAudioData は元の ArrayBuffer を消費するのでコピーを渡す
    buf = await c.decodeAudioData(data.slice(0))
    decoded.set(key, buf)
  }
  // 古いdecodeの完了で、後から押した音声や消音を上書きしない。
  if (request !== playbackVersion) return
  const source = c.createBufferSource()
  source.buffer = buf
  source.connect(c.destination)
  source.start(0)
  current = source
}

export function stopPlayback(): void {
  playbackVersion++
  if (current) {
    try {
      current.stop()
    } catch {
      /* すでに終わっていることがある */
    }
    current = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* noop */
    }
  }
}

/* ------------------------------------------------------------------ *
 * 端末の音声合成（音声ファイルが無いカードのため）
 * ------------------------------------------------------------------ */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** getVoices() は最初空で返ることがあるので、voiceschanged を待つ */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!speechAvailable()) return resolve([])
    const now = window.speechSynthesis.getVoices()
    if (now.length > 0) return resolve(now)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
    setTimeout(finish, timeoutMs)
  })
}

export function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

const VOICE_KEY = 'wordcards.voiceURI'

export function savedVoiceUri(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY)
  } catch {
    return null
  }
}

export function saveVoiceUri(uri: string): void {
  try {
    localStorage.setItem(VOICE_KEY, uri)
  } catch {
    /* プライベートブラウズなどで書けないことがある */
  }
}

/**
 * 使う声を決める。
 * 端末ごとに入っている声が違うので、教師が選べるようにしつつ、
 * 選んでいなければ品質の高そうなものを自動で選ぶ。
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = englishVoices(voices)
  if (en.length === 0) return null

  const saved = savedVoiceUri()
  const chosen = saved ? en.find((v) => v.voiceURI === saved) : undefined
  if (chosen) return chosen

  const enhanced = en.find((v) => /enhanced|premium|neural|siri/i.test(v.name))
  if (enhanced) return enhanced
  const us = en.find((v) => v.lang.toLowerCase().startsWith('en-us'))
  return us ?? en[0]
}

export interface SpeakOptions {
  rate?: number
  voice?: SpeechSynthesisVoice | null
  onError?: () => void
}

/** 単語を読み上げる。連打しても積み上がらないよう、毎回cancelしてから話す */
export function speak(text: string, { rate = 0.85, voice, onError }: SpeakOptions = {}): void {
  stopPlayback()
  const request = playbackVersion
  if (!speechAvailable() || !text.trim()) { onError?.(); return }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = voice?.lang ?? 'en-US'
  u.rate = rate
  if (voice) u.voice = voice
  u.onerror = (event) => {
    if (request === playbackVersion && event.error !== 'interrupted' && event.error !== 'canceled') onError?.()
  }
  try { window.speechSynthesis.speak(u) } catch { onError?.() }
}

/**
 * Safariでは、タブを離れて戻ると発話が止まったままになることがある。
 * 画面に復帰したときに呼んでリセットする。
 */
export function resetSpeech(): void {
  if (!speechAvailable()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* noop */
  }
}
