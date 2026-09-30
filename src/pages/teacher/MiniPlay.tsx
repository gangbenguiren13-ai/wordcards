import { useGameFont } from '@/games/shared/useGameFont'
import { ActionError } from '@/components/ActionError'
import { LoadingProgress } from '@/components/LoadingProgress'
import { useToast } from '@/components/toast/useToast'
import { rememberUsed } from '@/lib/recentSets'
import { lastMemorySettings, lastRevealSettings, rememberMiniSettings } from '@/games/shared/lastMiniSettings'
import { QuickStart, rememberStarted } from '@/games/shared/QuickStart'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSet, getCards, updateSet } from '@/api/sets'
import { signedUrls } from '@/lib/mediaStore'
import { preloadCards, releasePreloaded, type PreloadedCard } from '@/lib/preload'
import { loadVoices, pickVoice, unlockAudio } from '@/lib/audio'
import { hasBlockingError, validateSet } from '@/lib/validation'
import { toJapaneseError } from '@/lib/errorMessage'
import { AppHeader } from '@/components/AppHeader'
import { LoadError } from '@/components/LoadError'
import { Button, Spinner, Toggle, IssuePanel } from '@/components/ui'
import { MemorySettingsPanel, RevealSettingsPanel } from '@/games/shared/MiniSettings'
import { memoryCards, pickMemoryCards, GAME_NAMES, type MiniGame } from '@/games/shared/miniGames'
import { MemoryGame } from '@/games/shared/MemoryGame'
import { SlowRevealGame } from '@/games/shared/SlowRevealGame'
import type { MaterialSet, Card, MemoryDefaults, SlowRevealDefaults } from '@/types'

export function MiniPlayPage({ game }: { game: MiniGame }) {
  const { id = '' } = useParams()
  const sq = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cq = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })
  if (sq.isError || cq.isError) return <><AppHeader back={`/t/sets/${id}/play`} /><LoadError onRetry={() => { void sq.refetch(); void cq.refetch() }} retrying={sq.isFetching || cq.isFetching} /></>
  if (!sq.data || !cq.data) return <Spinner />
  return <MiniSetup key={`${id}:${game}`} set={sq.data} cards={cq.data} game={game} />
}

function MiniSetup({ set, cards, game }: { set: MaterialSet; cards: Card[]; game: MiniGame }) {
  const toast = useToast()
  const [failedAction, setFailedAction] = useState<'start' | 'save'>('start')
  const navigate = useNavigate()
  const qc = useQueryClient()
  useGameFont(set.mode)
  const [memory, setMemory] = useState(() => lastMemorySettings(set))
  const [reveal, setReveal] = useState(() => lastRevealSettings(set))
  const [enabled, setEnabled] = useState(set.games_config[game]?.enabledForStudents ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [playing, setPlaying] = useState<{ items: PreloadedCard[]; memory: MemoryDefaults; reveal: SlowRevealDefaults } | null>(null)
  const alive = useRef(true)
  const lock = useRef(false)
  useEffect(() => { alive.current = true; void loadVoices().then(v => { if (alive.current) setVoice(pickVoice(v)) }); return () => { alive.current = false } }, [])
  useEffect(() => () => { if (playing) releasePreloaded(playing.items) }, [playing])
  const usable = game === 'memory' ? memoryCards(cards, memory) : cards.filter(c => c.image_path)
  const blocked = hasBlockingError(validateSet({ title: set.title, mode: set.mode, gamesConfig: set.games_config, cards }))
  const insufficient = game === 'memory' ? usable.length < memory.cardCount / 2 : usable.length === 0
  async function start() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setFailedAction('start'); setProgress({ done: 0, total: game === 'memory' ? memory.cardCount / 2 : usable.length })
    try {
      await unlockAudio()
      const selected = game === 'memory' ? pickMemoryCards(cards, memory) : usable
      const urls = await signedUrls(selected.flatMap(c => [c.image_path, c.audio_path, ...(game === 'memory' && memory.pairType === 'image_pairimage' ? [c.pair_image_path] : [])]).filter((p): p is string => Boolean(p)))
      const result = await preloadCards(selected, urls, p => { if (alive.current) setProgress(p) }, game === 'memory' && memory.pairType === 'image_pairimage')
      if (!alive.current) { releasePreloaded(result.items); return }
      if (result.failures.length) { releasePreloaded(result.items); throw new Error('画像や音声を読み込めませんでした。通信を確認して、もう一度お試しください。') }
      rememberMiniSettings(set, game, game === 'memory' ? memory : reveal)
      rememberStarted(`${game}:${set.id}`)
      rememberUsed(set.owner_id, set.id)
      setPlaying({ items: result.items, memory, reveal })
    } catch (e) { if (alive.current) { setError(toJapaneseError(e)); toast.show(toJapaneseError(e)) } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  async function save() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setFailedAction('save')
    try {
      const latest = await getSet(set.id)
      const config = { ...latest.games_config }
      if (game === 'memory') config.memory = { enabledForStudents: enabled, defaults: memory, studentAdjustable: latest.games_config.memory?.studentAdjustable ?? ['cardCount'] }
      else config.slowreveal = { enabledForStudents: enabled, defaults: reveal, studentAdjustable: latest.games_config.slowreveal?.studentAdjustable ?? [] }
      await updateSet(set.id, { games_config: config })
      qc.setQueryData(['set', set.id], { ...latest, games_config: config })
      void qc.invalidateQueries({ queryKey: ['sets'] })
      if (alive.current) toast.show('保存しました', 'success')
    } catch (e) { if (alive.current) { setError(toJapaneseError(e)); toast.show(toJapaneseError(e)) } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  if (playing) return game === 'memory' ? <MemoryGame teacher set={set} items={playing.items} settings={playing.memory} voice={voice} onExit={() => navigate(`/t/sets/${set.id}/play`)} />
    : <SlowRevealGame set={set} items={playing.items} settings={playing.reveal} voice={voice} teacher onExit={() => navigate(`/t/sets/${set.id}/play`)} />
  return <><AppHeader title={`${GAME_NAMES[game]}の設定`} back={`/t/sets/${set.id}/play`} />
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <IssuePanel issues={validateSet({ title: set.title, mode: set.mode, gamesConfig: set.games_config, cards }).filter(i => i.level === 'warning')} />
      <QuickStart feedback={<>{/* 折りたたんでも開始できない理由を隠さない */}{insufficient && <p role="alert">{game === 'memory' ? `${memory.cardCount}枚で遊ぶには${memory.cardCount / 2}件の教材カードが必要です。枚数を減らすか、カードを追加してください。` : '画像のあるカードを追加してください。'}</p>}{blocked && <p role="alert">教材の未入力・エラーを直してから始めてください。</p>}{failedAction === 'start' && <ActionError error={error} onRetry={() => void start()} onDismiss={() => setError('')} busy={busy} />}</>} game={`${game}:${set.id}`} count={game === 'memory' ? memory.cardCount : usable.length}
        busy={busy} disabled={blocked || insufficient} onStart={() => void start()}
        summary={game === 'memory' ? `${memory.pick === 'random' ? 'ランダム' : '先頭から'}・${memory.teams === 1 ? '協力' : `${memory.teams}チーム対抗`}・${memory.timeLimitMinutes ? `${memory.timeLimitMinutes}分` : '時間制限なし'}・${set.audio_enabled && memory.audioOnMatch ? 'そろったら音声' : '自動音声なし'}`
          : `${reveal.order === 'random' ? 'ランダム' : '順番どおり'}・${reveal.advance === 'manual' ? '手で開く' : `自動 ${reveal.autoSeconds}秒`}・${reveal.steps}段階`}>
      <fieldset disabled={busy} className="rounded-xl border-2 border-line bg-surface px-4">
        {game === 'memory' ? <MemorySettingsPanel value={memory} onChange={setMemory} mode={set.mode} /> : <RevealSettingsPanel value={reveal} onChange={setReveal} mode={set.mode} />}
      </fieldset>
      </QuickStart>
      <p>{game === 'memory' ? '2枚ずつめくってペアを探します。そろうと同じチームが続けられます。' : '画像が少しずつ開きます。答えを予想してから「せいかい を みる」を押します。'}</p>
      <p>使えるカード：{usable.length}件{cards.length > usable.length ? `（画像などが足りない${cards.length - usable.length}件は除外）` : ''}</p>

      {busy && <LoadingProgress {...(failedAction === 'start' ? progress : {})} label={failedAction === 'start' ? 'カードの画像と音声を よみこみちゅう' : '設定を保存しています'} />}
      <fieldset disabled={busy} className="flex flex-col gap-3 rounded-xl border-2 border-line p-4"><Toggle label="生徒の共有画面でこのゲームを使えるようにする" checked={enabled} onChange={setEnabled} />
        <Button onClick={() => void save()}>この設定を教材に保存</Button>
        {failedAction === 'save' && <ActionError error={error} onRetry={() => void save()} onDismiss={() => setError('')} busy={busy} />}<p className="text-sm text-ink-soft">保存すると、次に開くときと生徒用リンクに反映されます。</p></fieldset>
    </main></>
}
