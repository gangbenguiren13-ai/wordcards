import { GameChoices } from '@/components/GameChoices'
import { GameIcon } from '@/components/GameIcon'
import { LoadingProgress } from '@/components/LoadingProgress'
import { useEffect, useRef, useState } from 'react'
import { fetchSharedSet, sharedGameData, SharedError } from '@/api/shared'
import { StudentLoadError } from '@/components/StudentLoadError'
import { Button } from '@/components/ui'
import { unlockAudio } from '@/lib/audio'
import { preloadCards, releasePreloaded, type PreloadedCard } from '@/lib/preload'
import { hasBlockingError, validateSet } from '@/lib/validation'
import { memorySettings, revealSettings, pickMemoryCards, memoryCards, STUDENT_GAME_NAMES, type MiniGame } from '@/games/shared/miniGames'
import { MemorySettingsPanel, RevealSettingsPanel } from '@/games/shared/MiniSettings'
import { SettingRow } from '@/games/shared/SettingsPanel'
import { MemoryGame } from '@/games/shared/MemoryGame'
import { SlowRevealGame } from '@/games/shared/SlowRevealGame'
import type { MaterialSet, MemoryDefaults, SlowRevealDefaults } from '@/types'

function permitted<T extends object>(defaults: T, candidate: T, keys: string[]): T {
  const out = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) if (keys.includes(String(key))) out[key] = candidate[key]
  return out
}
export function SharedMini({ token, set, game, voice, onBack }: {
  token: string; set: MaterialSet; game: MiniGame; voice: SpeechSynthesisVoice | null; onBack: () => void
}) {
  const [memory, setMemory] = useState(() => memorySettings(set))
  const [reveal, setReveal] = useState(() => revealSettings(set))
  // 今回この端末で遊ぶ人数。教材・サーバー・端末ストレージへは保存しない。
  const [cooperativePlayers, setCooperativePlayers] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState<SharedError | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [playing, setPlaying] = useState<{ set: MaterialSet; items: PreloadedCard[]; memory: MemoryDefaults; reveal: SlowRevealDefaults } | null>(null)
  const alive = useRef(true)
  const lock = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => () => { if (playing) releasePreloaded(playing.items) }, [playing])
  async function start() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await unlockAudio()
      const latest = sharedGameData(await fetchSharedSet(token))
      const entry = latest.set.games_config[game]
      if (!entry?.enabledForStudents) throw new Error('このゲームは おやすみちゅうです。先生に かくにんしてね。')
      if (hasBlockingError(validateSet({ title: latest.set.title, mode: latest.set.mode, gamesConfig: latest.set.games_config, cards: latest.cards }))) throw new Error('この教材は じゅんびちゅうです。先生に かくにんしてね。')
      const m = permitted(memorySettings(latest.set), memory, entry.studentAdjustable)
      const r = permitted(revealSettings(latest.set), reveal, entry.studentAdjustable)
      if (latest.set.mode === 'elementary') { if (m.pairType.startsWith('word')) m.pairType = 'image_image'; r.answerDisplay = 'image' }
      if (game === 'memory' && memoryCards(latest.cards, m).length < m.cardCount / 2) throw new Error('カードが たりません。枚数をへらすか、先生に かくにんしてね。')
      const cards = game === 'memory' ? pickMemoryCards(latest.cards, m) : latest.cards.filter(c => c.image_path)
      if (!cards.length) throw new Error('つかえるカードが ありません。先生に かくにんしてね。')
      const result = await preloadCards(cards, latest.urls, p => { if (alive.current) setProgress(p) }, game === 'memory' && m.pairType === 'image_pairimage')
      if (!alive.current) { releasePreloaded(result.items); return }
      if (result.failures.length) { releasePreloaded(result.items); throw new Error('画像や音声を よみこめませんでした。通信をたしかめて、もういちど。') }
      setPlaying({ set: latest.set, items: result.items, memory: m, reveal: r })
    } catch (e) { if (alive.current) {
      if (e instanceof SharedError && e.code === 'NOT_FOUND') setUnavailable(e)
      else setError(e instanceof Error ? e.message : 'もういちど おためしください。')
    } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  if (unavailable) return <StudentLoadError error={unavailable} onRetry={() => {}} />
  if (playing) return game === 'memory' ? <MemoryGame set={playing.set} items={playing.items} settings={playing.memory} cooperativePlayers={cooperativePlayers} voice={voice} onExit={onBack} />
    : <SlowRevealGame set={playing.set} items={playing.items} settings={playing.reveal} voice={voice} onExit={onBack} />
  return <main data-audience="student" className="student-surface student-prep"><div className="student-prep-panel">
    <Button variant="paper" disabled={busy} onClick={onBack}><GameIcon name="left" />ゲームえらびへ</Button><h1 className="text-center text-2xl font-bold">{STUDENT_GAME_NAMES[game]}</h1>
    <p>{game === 'memory' ? '2まいずつ めくって、ペアを さがそう。' : 'すこしずつ みえる えを あててみよう。'}</p>
    <fieldset disabled={busy} className="[&_button]:min-h-16">
      {game === 'memory' && memory.teams === 1 && <SettingRow label="あそぶ にんずう" hint="1だいを いっしょに つかいます。みんなで そうだんして、じゅんばんに めくろう。">
        <GameChoices players value={cooperativePlayers} onChange={setCooperativePlayers} values={[1, 2, 3, 4]} />
      </SettingRow>}
      {game === 'memory' ? <MemorySettingsPanel student value={memory} onChange={setMemory} mode={set.mode} adjustable={set.games_config.memory?.studentAdjustable ?? []} />
      : <RevealSettingsPanel student value={reveal} onChange={setReveal} mode={set.mode} adjustable={set.games_config.slowreveal?.studentAdjustable ?? []} />}</fieldset>
    {error && <p role="alert" className="font-bold text-danger-700">{error}</p>}
    <Button variant="play" size="xl" block disabled={busy} onClick={() => void start()}><GameIcon name="play" filled />{busy ? 'よみこみちゅう…' : 'はじめる'}</Button>
    {busy && <LoadingProgress student audioEnabled={set.audio_enabled} {...progress} label="カードの がぞうと おんせいを よみこみちゅう" />}
  </div></main>
}
