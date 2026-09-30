import { GameIcon } from '@/components/GameIcon'
import { GameWord } from '@/games/shared/GameWord'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MaterialSet } from '@/types'
import type { PreloadedCard } from '@/lib/preload'
import { GameShell } from '@/games/shared/GameShell'
import { EndScreen } from '@/games/shared/EndScreen'
import { Button, Dialog } from '@/components/ui'
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
  // 見た目専用：直前の変化が表裏の切りかえなら回り込み、カードの切りかえなら入ってくる動き。進行・★・音声には使わない
  const [turned, setTurned] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [audioOn, setAudioOn] = useState(true)
  const [finished, setFinished] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  function requestExit() { stopPlayback(); setExitOpen(true) }
  const exitDialog = <Dialog game danger open={exitOpen} title="ゲームを やめますか？" confirmLabel="ゲームをやめる" cancelLabel="ゲームをつづける" onConfirm={onExit} onCancel={() => setExitOpen(false)}>★のきろくは きえます。</Dialog>

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
    setTurned(false)
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
    if (!twoSided) return
    setFlipped((f) => !f)
    setTurned(true)
  }, [twoSided])

  const toggleMark = useCallback(() => {
    if (!currentId) return
    setStates((s) => toggleReview(s, currentId))
  }, [currentId])

  // 自動送り
  useEffect(() => {
    if (finished || exitOpen || settings.advance !== 'auto') return
    const timer = setTimeout(goNext, settings.autoSeconds * 1000)
    return () => clearTimeout(timer)
  }, [finished, exitOpen, position, lapIndex, settings.advance, settings.autoSeconds, goNext])

  // キーボード操作（大型画面に映して教卓のPCから操作する場面のため）
  useEffect(() => {
    if (finished || exitOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, input, select, textarea, [role="dialog"]')) return
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
  }, [finished, exitOpen, goNext, goPrev, flip, toggleMark, playCurrent])

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
    if (!start || exitOpen) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    // スワイプでなければ、押した位置で判断する
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const edge = Math.min(96, Math.max(64, rect.width * 0.12))
    if (e.clientX - rect.left < edge) goPrev()
    else goNext()
  }

  /* ---------------- 表示 ---------------- */

  if (finished) {
    const marked = reviewIds(states)
      .map((id) => byId.get(id)?.card)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    const stillHas = hasRemainingReview(states)
    return (
      <GameShell teacher={teacher} screenMode={settings.screenMode} title={set.title} onExit={requestExit}>
        <EndScreen teacher={teacher}
          title={stillHas ? 'おつかれさま！' : 'ぜんぶ できました！'}
          message={stillHas ? undefined : '★のカードはもうありません。'}
          reviewCards={marked}
          showWords={set.mode !== 'elementary'}
          imageUrlOf={(c) => byId.get(c.id)?.imageUrl ?? null}
          onReviewAgain={stillHas ? reviewAgain : undefined}
          onRestart={restartFromStart}
          onFinish={requestExit}
        />
        {exitDialog}
    </GameShell>
    )
  }

  if (!current) {
    return (
      <GameShell teacher={teacher} screenMode={settings.screenMode} title={set.title} onExit={requestExit}>
        <section className="m-auto flex flex-col items-center gap-4 text-center">
          <span aria-hidden="true" className="text-5xl"><GameIcon name="cards" width="64" height="64" /></span>
          <p className="font-bold">このセットには表示できるカードがありません。</p>
          <Button variant="paper" size="xl" onClick={requestExit}>ゲームえらびに もどる</Button>
        </section>
        {exitDialog}
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
    showWord = set.mode !== 'elementary' && set.show_word_on_answer && revealed
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
    <GameShell teacher={teacher} screenMode={settings.screenMode}
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
      onExit={requestExit}
      footer={
        <div className="mx-auto flex max-w-5xl flex-wrap gap-3">
          <Button variant="paper" size="xl" onClick={goPrev} disabled={position === 0} aria-label="前のカード">
            <GameIcon name="left" />
          </Button>
          {set.audio_enabled && (
            <Button variant="paper" size="xl" onClick={playCurrent} className="sound-ripple" aria-label="音を鳴らす" disabled={!audioOn}>
              <GameIcon name="sound" />
            </Button>
          )}
          {set.mode !== 'elementary' && display === 'image_only' && set.show_word_on_answer && (
            <Button variant="paper" size="xl" onClick={() => setRevealed(true)} disabled={revealed}>
              こたえを みる
            </Button>
          )}
          {twoSided && (
            <Button variant="paper" size="xl" onClick={flip}>
              うらを みる
            </Button>
          )}
          <Button variant={isMarked ? 'review' : 'paper'}
            size="xl"
            onClick={toggleMark}
            aria-pressed={isMarked}
            aria-label={isMarked ? '★ もういちど' : '☆ もういちど'}
          >
            <GameIcon name="star" filled={isMarked} />もういちど
          </Button>
          <Button variant="play" size="xl" className="min-w-32 flex-1" onClick={goNext} aria-label="次のカード">
            つぎへ <GameIcon name="right" />
          </Button>
        </div>
      }
    >
      <div
        className="flash-deck relative flex min-h-0 flex-1 cursor-pointer touch-manipulation flex-col items-center justify-center gap-4 rounded-2xl border-2 border-line bg-surface text-ink px-[clamp(64px,12%,96px)] py-4"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { touchStart.current = null }}
        role="button"
        tabIndex={0}
        aria-label="カード。中央と右の矢印でつぎへ、左の矢印でまえへ"
      >
        <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 flex w-[clamp(64px,12%,96px)] items-center justify-center rounded-l-2xl bg-brand-50 text-4xl text-brand-700 ${position === 0 ? 'opacity-15' : 'opacity-50'}`}><GameIcon name="left" /></span>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-[clamp(64px,12%,96px)] items-center justify-center rounded-r-2xl bg-brand-50 text-4xl text-brand-700 opacity-50"><GameIcon name="right" /></span>
        <div key={`${currentId}:${twoSided && flipped}`} className={`flash-face ${twoSided && turned ? 'flash-face--turn' : ''}`} data-flipped={twoSided && flipped}><div className="flash-content">
        {isMarked && (
          <span className="review-sticker absolute left-3 top-3 rounded-lg bg-game-star px-2 py-1 text-sm font-bold text-[#2a1e00]">
            <GameIcon name="star" filled />
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
        {showWord && <GameWord word={word} mode={settings.screenMode} />}
        </div></div>
      </div>
      {exitDialog}
    </GameShell>
  )
}
