import { useEffect, useRef, useState } from 'react'
import type { MaterialSet, MemoryDefaults } from '@/types'
import type { PreloadedCard } from '@/lib/preload'
import { playBuffer, speak, stopPlayback } from '@/lib/audio'
import { Button, Dialog } from '@/components/ui'
import { GameShell } from './GameShell'
import { shuffled } from './miniGames'

export interface MemoryTile { item: PreloadedCard; side: 0 | 1 }
export function makeBoard(items: PreloadedCard[]): MemoryTile[] {
  return shuffled(items.flatMap(item => [{ item, side: 0 as const }, { item, side: 1 as const }]))
}
export function MemoryGame({ set, items, settings: s, voice, onExit }: {
  set: MaterialSet; items: PreloadedCard[]; settings: MemoryDefaults; voice: SpeechSynthesisVoice | null; onExit: () => void
}) {
  const [board] = useState(() => makeBoard(items))
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [scores, setScores] = useState(() => Array.from({ length: s.teams }, () => 0))
  const [team, setTeam] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [audioOn, setAudioOn] = useState(true)
  const [exit, setExit] = useState(false)
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const started = useRef<number | null>(null)
  const ended = matched.length === items.length || (s.timeLimitMinutes !== null && elapsed >= s.timeLimitMinutes * 60)
  useEffect(() => {
    started.current ??= Date.now()
    if (ended) return
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - started.current!) / 1000)), 250)
    return () => clearInterval(clock)
  }, [ended])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); stopPlayback() }, [])

  function flip(index: number) {
    if (ended || exit || lock.current || open.includes(index) || matched.includes(board[index].item.card.id)) return
    const next = [...open, index]
    setOpen(next)
    if (next.length !== 2) return
    lock.current = true
    const first = board[next[0]].item
    const match = first.card.id === board[index].item.card.id
    if (match) {
      setMatched(old => [...old, first.card.id])
      setScores(old => old.map((score, i) => i === team ? score + 1 : score))
      if (set.audio_enabled && audioOn && s.audioOnMatch) {
        if (first.audio) void playBuffer(`${set.id}:${first.card.id}:${first.card.updated_at}`, first.audio).catch(() => {})
        else speak(first.card.word, { voice })
      }
    }
    timer.current = setTimeout(() => {
      setOpen([]); lock.current = false
      if (!match) setTeam(t => (t + 1) % s.teams)
    }, match ? 350 : 900)
  }
  return <GameShell title="神経衰弱" onExit={() => setExit(true)} audioEnabled={set.audio_enabled} audioOn={audioOn}
    onToggleAudio={() => { setAudioOn(!audioOn); stopPlayback() }}>
    <div className="sticky top-0 z-10 flex flex-wrap justify-center gap-2 bg-canvas p-2" aria-live="polite">
      {scores.map((score, i) => <p key={i} className={`rounded-xl border-2 p-2 font-bold ${i === team && !ended ? 'border-brand-500 bg-brand-50' : 'border-line'}`}>
        {s.teams > 1 ? `チーム${i + 1}${i === team && !ended ? ' のばん' : ''}：` : 'そろったペア：'}{score}</p>)}
      <p className="p-2 tabular-nums">{s.timeLimitMinutes ? `のこり ${Math.max(0, s.timeLimitMinutes * 60 - elapsed)}` : elapsed}秒</p>
    </div>
    {ended ? <section className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <h2 className="text-3xl font-bold">{matched.length === items.length ? 'ぜんぶ そろった！' : 'じかんです！'}</h2>
      <p>{matched.length} / {items.length}ペア・{elapsed}秒</p><Button variant="primary" onClick={onExit}>ゲームえらびへ</Button>
    </section> : <div className={`mx-auto grid w-full max-w-6xl gap-2 ${board.length === 20 ? 'grid-cols-4 landscape:grid-cols-5' : 'grid-cols-4'}`}>
      {board.map((tile, i) => {
        const faceUp = open.includes(i) || matched.includes(tile.item.card.id)
        const done = matched.includes(tile.item.card.id)
        const text = set.mode !== 'elementary' && (s.pairType === 'word_word' || (s.pairType === 'word_image' && tile.side === 0))
        const src = s.pairType === 'image_pairimage' && tile.side === 1 ? tile.item.pairImageUrl : tile.item.imageUrl
        return <button key={i} type="button" aria-label={`カード ${i + 1}${done ? ' そろった' : faceUp ? ' おもて' : ''}`} aria-pressed={faceUp}
          disabled={done || (open.length === 2)} onClick={() => flip(i)} className="relative min-h-20 rounded-xl focus-visible:outline-4 focus-visible:outline-brand-500"
          style={{ height: `clamp(80px, ${board.length <= 12 ? '22' : '16'}dvh, 220px)`, perspective: '900px' }}>
          <span className="relative block h-full w-full transition-transform duration-300 motion-reduce:transition-none" style={{ transformStyle: 'preserve-3d', transform: faceUp ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-brand-500 bg-brand-50 text-3xl font-bold" style={{ backfaceVisibility: 'hidden' }}>{i + 1}</span>
            <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border-2 border-brand-500 bg-surface p-2" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              {faceUp && (text ? <span className="break-all font-bold leading-tight" style={{ fontSize: `clamp(16px, ${Math.min(8.4, 22 / Math.max(1, tile.item.card.word.length))}vw, 72px)` }}>{tile.item.card.word}</span> : src ? <img src={src} alt="" className="h-full w-full object-contain" /> : null)}
              {done && <span className="absolute right-1 top-0 text-2xl font-bold text-brand-700">✓</span>}
            </span>
          </span>
        </button>
      })}
    </div>}
    <Dialog open={exit} title="ゲームをやめますか？" onCancel={() => setExit(false)} onConfirm={onExit} confirmLabel="やめる" cancelLabel="つづける">
      <p>いまの得点は保存されません。</p>
    </Dialog>
  </GameShell>
}
