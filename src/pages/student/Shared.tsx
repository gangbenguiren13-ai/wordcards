import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSharedSet, sharedGameData, SharedError } from '@/api/shared'
import { Button, Spinner } from '@/components/ui'
import { FlashcardsGame } from '@/games/flashcards/FlashcardsGame'
import { effectiveDisplay, type FlashcardsSettings } from '@/games/flashcards/settings'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import { loadVoices, pickVoice, unlockAudio } from '@/lib/audio'
import { preloadCards, releasePreloaded, type PreloadedCard } from '@/lib/preload'
import { selectUsableCards } from '@/lib/usableCards'
import { hasBlockingError, validateSet } from '@/lib/validation'
import type { MaterialSet } from '@/types'

export function SharedPage() {
  const { token = '' } = useParams()
  // トークン変更時に、前の教材・ゲーム・取得中の処理を持ち越さない。
  return <SharedSession key={token} token={token} />
}

function SharedSession({ token }: { token: string }) {
  const query = useQuery({ queryKey: ['shared', token], queryFn: () => fetchSharedSet(token),
    retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [override, setOverride] = useState<Partial<FlashcardsSettings>>({})
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [playing, setPlaying] = useState<{ set: MaterialSet; settings: FlashcardsSettings; items: PreloadedCard[] } | null>(null)
  const alive = useRef(true)
  const starting = useRef(false)
  useEffect(() => {
    alive.current = true
    void loadVoices().then((voices) => { if (alive.current) setVoice(pickVoice(voices)) })
    return () => { alive.current = false }
  }, [])
  useEffect(() => () => { if (playing) releasePreloaded(playing.items) }, [playing])

  async function start() {
    if (starting.current) return
    starting.current = true
    setBusy(true); setError(''); setProgress({ done: 0, total: 0 })
    try {
      // iPad用の音声解除は、非同期取得より前にボタン操作から呼ぶ。
      await unlockAudio()
      const { set, cards, urls } = sharedGameData(await fetchSharedSet(token))
      const entry = set.games_config.flashcards
      if (!entry?.enabledForStudents) throw new Error('このゲームは おやすみちゅうです。先生に かくにんしてね。')
      const settings = { ...FLASHCARDS_DEFAULTS, ...entry.defaults }
      // 生徒側では教師用localStorageの設定を一切読み込まない。
      if (entry.studentAdjustable.includes('order') && override.order) settings.order = override.order
      if (entry.studentAdjustable.includes('advance') && override.advance) settings.advance = override.advance
      if (hasBlockingError(validateSet({ title: set.title, mode: set.mode, gamesConfig: set.games_config, cards }))) {
        throw new Error('この教材は じゅんびちゅうです。先生に かくにんしてね。')
      }
      const usable = selectUsableCards(cards, effectiveDisplay(set, settings)).usable
      if (!usable.length) throw new Error('つかえるカードが ありません。先生に かくにんしてね。')
      const result = await preloadCards(usable, urls, (p) => { if (alive.current) setProgress(p) })
      if (!alive.current) { releasePreloaded(result.items); return }
      if (result.failures.length) {
        releasePreloaded(result.items)
        throw new Error('画像や音声を よみこめませんでした。通信を たしかめて、もういちど。')
      }
      setPlaying({ set, settings, items: result.items })
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'よみこめませんでした。もういちど。')
    } finally {
      starting.current = false
      if (alive.current) setBusy(false)
    }
  }

  if (playing) return <FlashcardsGame {...playing} voice={voice} onExit={() => { setPlaying(null); void query.refetch() }} />
  if (query.isPending) return <Spinner />
  if (query.isError) return <main className="mx-auto flex max-w-lg flex-col gap-5 p-6 text-center">
    <h1 className="text-2xl font-bold">このページは つかえません</h1>
    <p role="alert">{query.error instanceof SharedError ? query.error.message : '通信を たしかめて、もういちど。'}</p>
    <Button disabled={query.isFetching} onClick={() => void query.refetch()}>もういちど よみこむ</Button>
  </main>
  const entry = query.data.set.gamesConfig.flashcards
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6 text-center">
    <h1 className="text-2xl font-bold">{query.data.set.title}</h1>
    <p>フラッシュカード</p>
    {error && <p role="alert" className="font-bold text-danger-700">{error}</p>}
    {!entry?.enabledForStudents ? <p>いま つかえるゲームは ありません。先生に かくにんしてね。</p> : <>
      {entry.studentAdjustable.includes('order') && <label className="flex flex-col gap-2 font-bold">出すじゅんばん
        <select disabled={busy} className="min-h-12 rounded-xl border-2 border-line p-2"
          value={override.order ?? entry.defaults.order} onChange={(e) => setOverride((s) => ({ ...s, order: e.target.value as FlashcardsSettings['order'] }))}>
          <option value="sequential">じゅんばんどおり</option><option value="random">ランダム</option>
        </select></label>}
      {entry.studentAdjustable.includes('advance') && <label className="flex flex-col gap-2 font-bold">カードのおくりかた
        <select disabled={busy} className="min-h-12 rounded-xl border-2 border-line p-2"
          value={override.advance ?? entry.defaults.advance} onChange={(e) => setOverride((s) => ({ ...s, advance: e.target.value as FlashcardsSettings['advance'] }))}>
          <option value="manual">タッチでおくる</option><option value="auto">じどうでおくる</option>
        </select></label>}
      <Button variant="primary" size="xl" block disabled={busy} onClick={() => void start()}>
        {busy ? 'よみこみちゅう…' : error ? 'もういちど はじめる' : '▶ はじめる'}
      </Button>
    </>}
    {busy && <div role="status"><progress className="w-full" value={progress.done} max={progress.total || 1} />
      <p>{progress.done} / {progress.total}</p></div>}
    <p className="text-sm text-ink-soft">はじめに画像と音声をよみこみます。</p>
  </main>
}
