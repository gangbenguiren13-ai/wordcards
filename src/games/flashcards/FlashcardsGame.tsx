import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MaterialSet } from '@/types'
import type { PreloadedCard } from '@/lib/preload'
import { GameShell } from '@/games/shared/GameShell'
import { EndScreen } from '@/games/shared/EndScreen'
import { Button } from '@/components/ui'
import {
  buildLap,
  createStates,
  hasRemainingReview,
  reviewIds,
  toggleReview,
  type CardState,
} from './reviewQueue'
import { effectiveDisplay, isTwoSided, type FlashcardsSettings } from './settings'
import { playBuffer, resetSpeech, speak, stopPlayback } from '@/lib/audio'

/** 連打でカードが飛ぶのを防ぐ最小間隔 */
const ADVANCE_DEBOUNCE_MS = 250
/** スワイプと判定する横移動の距離 */
const SWIPE_THRESHOLD_PX = 60

interface Props {
  teacher?: boolean
  set: MaterialSet
  items: PreloadedCard[]
  settings: FlashcardsSettings
  voice: SpeechSynthesisVoice | null
  onExit: () => void
}

export function FlashcardsGame({ set, items, settings, voice, onExit, teacher = false }: Props) {
  const display = effectiveDisplay(set, settings)
  const twoSided = isTwoSided(display)
  const cardIds = useMemo(() => items.map((i) => i.card.id), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.card.id, i])), [items])

  const [states, setStates] = useState<Map<string, CardState>>(() => createStates(cardIds))
  const [lapIndex, setLapIndex] = useState(0)
  const [queue, setQueue] = useState<string[]>(() =>
    buildLap({ cardIds, states: createStates(cardIds), mode: settings.reviewMode, order: settings.order, lapIndex: 0 }),
  )
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [audioOn, setAudioOn] = useState(true)
  const [finished, setFinished] = useState(false)

  const lastAdvance = useRef(0)
  const currentId = queue[position]
  const current = currentId ? byId.get(currentId) : undefined
  const isMarked = currentId ? Boolean(states.get(currentId)?.review) : false

  /* ---------------- 音声 ---------------- */

  const audioUsable = set.audio_enabled && audioOn

  const playCurrent = useCallback(() => {
    if (!current || !audioUsable) return
    if (current.audio) {
      void playBuffer(current.card.id, current.audio).catch(() => {
        // 再生に失敗したら端末の声にまかせる
        speak(current.card.word, { voice })
      })
    } else {
      speak(current.card.word, { voice })
    }
  }, [current, audioUsable, voice])

  // カードが変わったら、設定に応じて自動で読み上げる。
  // 表裏やこたえの状態は、めくる操作そのものの中で戻す（下の resetCardView）。
  useEffect(() => {
    if (audioUsable && settings.audioAutoplay) playCurrent()
    // playCurrent は current に依存するので、position/lapIndex の変化で足りる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, lapIndex])

  const resetCardView = useCallback(() => {
    setFlipped(false)
    setRevealed(false)
  }, [])

  // Safariでは画面を離れて戻ると読み上げが止まったままになることがある
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') resetSpeech()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      stopPlayback()
    }
  }, [])

  /* ---------------- 進行 ---------------- */

  const finishLap = useCallback(() => {
    stopPlayback()
    setFinished(true)
  }, [])

  const goNext = useCallback(() => {
    const now = Date.now()
    if (now - lastAdvance.current < ADVANCE_DEBOUNCE_MS) return
    lastAdvance.current = now
    stopPlayback()
    resetCardView()
    setPosition((p) => {
      if (p + 1 >= queue.length) {
        finishLap()
        return p
      }
      return p + 1
    })
  }, [queue.length, finishLap, resetCardView])

  const goPrev = useCallback(() => {
    const now = Date.now()
    if (now - lastAdvance.current < ADVANCE_DEBOUNCE_MS) return
    lastAdvance.current = now
    stopPlayback()
    resetCardView()
    setPosition((p) => Math.max(0, p - 1))
  }, [resetCardView])

  const flip = useCallback(() => {
    if (twoSided) setFlipped((f) => !f)
  }, [twoSided])

  const toggleMark = useCallback(() => {
    if (!currentId) return
    setStates((s) => toggleReview(s, currentId))
  }, [currentId])

  // 自動送り
  useEffect(() => {
    if (finished || settings.advance !== 'auto') return
    const timer = setTimeout(goNext, settings.autoSeconds * 1000)
    return () => clearTimeout(timer)
  }, [finished, position, lapIndex, settings.advance, settings.autoSeconds, goNext])

  // キーボード操作（大型画面に映して教卓のPCから操作する場面のため）
  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'Enter':
          e.preventDefault(); goNext(); break
        case 'ArrowLeft':
          e.preventDefault(); goPrev(); break
        case 'ArrowUp': case 'ArrowDown':
          e.preventDefault(); flip(); break
        case 'f': case 'F':
          e.preventDefault(); toggleMark(); break
        case 'a': case 'A':
          e.preventDefault(); playCurrent(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, goNext, goPrev, flip, toggleMark, playCurrent])

  /* ---------------- 周回の切り替え ---------------- */

  function startLap(nextLap: number, nextStates: Map<string, CardState>) {
    const q = buildLap({
      cardIds, states: nextStates, mode: settings.reviewMode, order: settings.order, lapIndex: nextLap,
    })
    if (q.length === 0) {
      setFinished(true)
      return
    }
    setStates(nextStates)
    setQueue(q)
    setLapIndex(nextLap)
    setPosition(0)
    setFinished(false)
    resetCardView()
  }

  function restartFromStart() {
    const fresh = createStates(cardIds)
    startLap(0, fresh)
  }

  function reviewAgain() {
    startLap(lapIndex + 1, states)
  }

  /* ---------------- スワイプ ---------------- */

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onPointerDown(e: React.PointerEvent) {
    touchStart.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerUp(e: React.PointerEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    // スワイプでなければ、押した位置で判断する
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    if (twoSided && ratio > 0.3 && ratio < 0.7) flip()
    else if (ratio < 0.3) goPrev()
    else goNext()
  }

  /* ---------------- 表示 ---------------- */

  if (finished) {
    const marked = reviewIds(states)
      .map((id) => byId.get(id)?.card)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    const stillHas = hasRemainingReview(states)
    return (
      <GameShell teacher={teacher} title={set.title} onExit={onExit}>
        <EndScreen
          title={stillHas ? 'おつかれさま！' : 'ぜんぶ できました！'}
          message={stillHas ? undefined : '★のカードはもうありません。'}
          reviewCards={marked}
          showWords={set.mode !== 'elementary' || set.show_word_on_answer}
          imageUrlOf={(c) => byId.get(c.id)?.imageUrl ?? null}
          onReviewAgain={stillHas ? reviewAgain : undefined}
          onRestart={restartFromStart}
          onFinish={onExit}
        />
      </GameShell>
    )
  }

  if (!current) {
    return (
      <GameShell teacher={teacher} title={set.title} onExit={onExit}>
        <p className="m-auto text-center font-bold text-ink-soft">
          このセットには表示できるカードがありません。
        </p>
      </GameShell>
    )
  }

  const word = current.card.word
  const img = current.imageUrl

  // 何を見せるか。表裏モードでは flipped で入れ替わる
  let showImage: boolean
  let showWord: boolean
  if (display === 'image_only') {
    showImage = true
    showWord = set.show_word_on_answer && revealed
  } else if (display === 'word_only') {
    showImage = false
    showWord = true
  } else if (display === 'word_image') {
    showImage = true
    showWord = true
  } else if (display === 'front_image_back_word') {
    showImage = !flipped
    showWord = flipped
  } else {
    showImage = flipped
    showWord = !flipped
  }

  return (
    <GameShell teacher={teacher}
      title={set.title}
      progress={{ current: position + 1, total: queue.length }}
      showProgress={settings.showProgress}
      audioEnabled={set.audio_enabled}
      audioOn={audioOn}
      onToggleAudio={() => {
        setAudioOn((v) => {
          if (v) stopPlayback()
          return !v
        })
      }}
      onExit={onExit}
      footer={
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button size="lg" onClick={goPrev} disabled={position === 0} aria-label="前のカード">
            ←
          </Button>
          {set.audio_enabled && (
            <Button size="lg" onClick={playCurrent} aria-label="音を鳴らす" disabled={!audioOn}>
              🔊
            </Button>
          )}
          {display === 'image_only' && set.show_word_on_answer && (
            <Button size="lg" onClick={() => setRevealed(true)} disabled={revealed}>
              こたえを みる
            </Button>
          )}
          {twoSided && (
            <Button size="lg" onClick={flip}>
              うらを みる
            </Button>
          )}
          <Button
            size="lg"
            onClick={toggleMark}
            aria-pressed={isMarked}
            className={isMarked ? 'border-warn-500 bg-warn-50 text-warn-700' : ''}
          >
            {isMarked ? '★ もういちど' : '☆ もういちど'}
          </Button>
          <Button variant="primary" size="lg" block onClick={goNext} aria-label="次のカード">
            つぎへ →
          </Button>
        </div>
      }
    >
      <div
        className="relative flex min-h-0 flex-1 cursor-pointer touch-manipulation flex-col items-center justify-center gap-4 rounded-2xl border-2 border-line bg-surface p-4"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label="カード。右側をタップで次へ、左側で前へ"
      >
        {isMarked && (
          <span className="absolute left-3 top-3 rounded-lg bg-warn-500 px-2 py-1 text-sm font-bold text-white">
            ★
          </span>
        )}
        {showImage &&
          (img ? (
            <img
              src={img}
              alt=""
              draggable={false}
              className="max-h-full min-h-0 w-auto max-w-full flex-1 object-contain"
            />
          ) : (
            <span className="flex flex-1 items-center text-ink-soft">画像なし</span>
          ))}
        {showWord && (
          <span
            className={[
              'break-all text-center font-bold leading-tight',
              showImage ? 'shrink-0 text-4xl sm:text-5xl' : 'text-6xl sm:text-8xl',
            ].join(' ')}
          >
            {word}
          </span>
        )}
      </div>
    </GameShell>
  )
}
