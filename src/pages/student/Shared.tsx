import { Mascot } from '@/components/mascot/Mascot'
import { useGameFont } from '@/games/shared/useGameFont'
import { GameIcon } from '@/components/GameIcon'
import { LoadingProgress } from '@/components/LoadingProgress'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSharedSet, sharedGameData, SharedError } from '@/api/shared'
import { StudentLoadError } from '@/components/StudentLoadError'
import { Button } from '@/components/ui'
import { FlashcardsGame } from '@/games/flashcards/FlashcardsGame'
import { effectiveDisplay, type FlashcardsSettings } from '@/games/flashcards/settings'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import { loadVoices, pickVoice, unlockAudio } from '@/lib/audio'
import { preloadCards, releasePreloaded, type PreloadedCard } from '@/lib/preload'
import { selectUsableCards } from '@/lib/usableCards'
import { hasBlockingError, validateSet } from '@/lib/validation'
import type { MaterialSet } from '@/types'
import { SharedMini } from './SharedMini'
import { STUDENT_GAME_NAMES, memoryCards, memorySettings, type MiniGame } from '@/games/shared/miniGames'

export function SharedPage() {
  const { token = '' } = useParams()
  // トークン変更時に、前の教材・ゲーム・取得中の処理を持ち越さない。
  return <SharedSession key={token} token={token} />
}

function SharedSession({ token }: { token: string }) {
  const query = useQuery({ queryKey: ['shared', token], queryFn: () => fetchSharedSet(token),
    retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const [busy, setBusy] = useState(false)
  const [game, setGame] = useState<MiniGame | 'flashcards' | null>(null)
  useGameFont(query.data?.set.mode, game !== null)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState<SharedError | null>(null)
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
      if (alive.current && e instanceof SharedError && e.code === 'NOT_FOUND') setUnavailable(e)
      if (alive.current) setError(e instanceof Error ? e.message : 'よみこめませんでした。もういちど。')
    } finally {
      starting.current = false
      if (alive.current) setBusy(false)
    }
  }

  if (unavailable) return <StudentLoadError error={unavailable} onRetry={() => {}} />
  if (playing) return <FlashcardsGame {...playing} voice={voice} onExit={() => { setPlaying(null); setGame(null); void query.refetch() }} />
  if (query.isPending) return <main data-audience="student" className="student-surface"><LoadingProgress student /></main>
  if (query.isError) return <StudentLoadError error={query.error} retrying={query.isFetching} onRetry={() => void query.refetch()} />
  const entry = query.data.set.gamesConfig.flashcards
  const publicData = sharedGameData(query.data)
  const availableMini = (['memory', 'slowreveal'] as const).filter(game => publicData.set.games_config[game]?.enabledForStudents &&
    (game === 'memory' ? memoryCards(publicData.cards, memorySettings(publicData.set)).length >= 4 : publicData.cards.some(c => c.image_path)))
  const backToGames = () => { setGame(null); setError(''); void query.refetch() }
  if (game && game !== 'flashcards') return <SharedMini token={token} set={publicData.set} game={game} voice={voice} onBack={backToGames} />
  if (!game) return <main data-audience="student" className="student-surface game-choice-page">
    <div className="choice-heading"><Mascot /><h1 className="speech-bubble">どれで あそぶ？</h1></div>
    <p className="material-badge"><span>{query.data.set.title}</span><span>{publicData.cards.length}まい</span></p>
    <h2 className="sr-only">ゲームをえらぶ</h2>
    <section aria-label="あそべるゲーム" className="game-tiles">
      {entry?.enabledForStudents && <button aria-label="フラッシュカードで あそぶ" className="game-tile game-tile--flash" onClick={() => setGame('flashcards')}>
        <GameIcon name="cards" width="100" height="100" /><span>フラッシュカード<small>で あそぶ</small></span><GameIcon name="play" filled />
      </button>}
      {availableMini.map(kind => <button key={kind} aria-label={`${STUDENT_GAME_NAMES[kind]}で あそぶ`} className={`game-tile game-tile--${kind}`} onClick={() => setGame(kind)}>
        <GameIcon name={kind === 'memory' ? 'star' : 'reveal'} width="100" height="100" /><span>{STUDENT_GAME_NAMES[kind]}<small>で あそぶ</small></span><GameIcon name="play" filled />
      </button>)}
    </section>
    {!entry?.enabledForStudents && !availableMini.length && <p>いま つかえるゲームは ありません。先生に かくにんしてね。</p>}
  </main>
  return <main data-audience="student" className="student-surface student-prep">
    <div className="student-prep-panel"><Button variant="paper" disabled={busy} onClick={backToGames}><GameIcon name="left" />ゲームえらびへ</Button>
    <h1 className="text-2xl font-bold">フラッシュカード</h1>
    <p>{query.data.set.title}</p>
    {error && <p role="alert" className="font-bold text-danger-700">{error}</p>}
    {!entry?.enabledForStudents ? (availableMini.length ? null : <p>いま つかえるゲームは ありません。先生に かくにんしてね。</p>) : <>
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
      <Button variant="play" size="xl" block disabled={busy} onClick={() => void start()}>
        <GameIcon name="play" filled />{busy ? 'よみこみちゅう…' : error ? 'もういちど はじめる' : 'はじめる'}
      </Button>
    </>}
    {busy && <LoadingProgress student audioEnabled={query.data.set.audioEnabled} {...progress} label="カードの がぞうと おんせいを よみこみちゅう" />}
    <p className="text-sm text-ink-soft">はじめに がぞうと おんせいを よみこみます。</p>
  </div></main>
}
