import { Celebration } from '@/components/Celebration'
import { GameIcon } from '@/components/GameIcon'
import { useEffect, useRef, useState } from 'react'
import type { MaterialSet, SlowRevealDefaults } from '@/types'
import type { PreloadedCard } from '@/lib/preload'
import { playBuffer, speak, stopPlayback } from '@/lib/audio'
import { Button, Dialog } from '@/components/ui'
import { GameShell } from './GameShell'
import { shuffled } from './miniGames'

export function revealClip(direction: SlowRevealDefaults['direction'], step: number, steps: number) {
  const fraction = Math.min(1, Math.max(0, step / steps))
  const hidden = (1 - fraction) * 100
  if (direction === 'center') return `circle(${fraction * 71}% at 50% 50%)`
  return `inset(${direction === 'bottom' ? hidden : 0}% ${direction === 'left' ? hidden : 0}% ${direction === 'top' ? hidden : 0}% ${direction === 'right' ? hidden : 0}%)`
}
export function RevealStage({ imageUrl, steps, currentStep, direction }: {
  imageUrl: string; steps: number; currentStep: number; direction: SlowRevealDefaults['direction']
}) {
  return <div className="reveal-window relative w-full shrink-0 overflow-hidden rounded-2xl" style={{ height: 'max(180px, calc(100dvh - 390px))' }}>
    <div className="reveal-sky" aria-hidden="true"><GameIcon name="star" /><span className="reveal-cloud" /><GameIcon name="star" /><span className="reveal-cloud" />{currentStep === 0 && <span className="reveal-question">？</span>}</div>
    <div className="reveal-image-glow"><img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain bg-white transition-[clip-path] duration-400 motion-reduce:transition-none"
      style={{ clipPath: revealClip(direction, currentStep, steps) }} /></div>
  </div>
}
export function SlowRevealGame({ set, items, settings: s, voice, onExit, teacher = false }: {
  set: MaterialSet; items: PreloadedCard[]; settings: SlowRevealDefaults; voice: SpeechSynthesisVoice | null; onExit: () => void; teacher?: boolean
}) {
  const [queue] = useState(() => s.order === 'random' ? shuffled(items) : items)
  const [position, setPosition] = useState(0)
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState(false)
  const [paused, setPaused] = useState(false)
  const [audioOn, setAudioOn] = useState(true)
  const [exit, setExit] = useState(false)
  const last = useRef(0)
  const item = queue[position]
  const finished = !item
  useEffect(() => () => stopPlayback(), [])
  useEffect(() => {
    if (s.advance !== 'auto' || paused || answer || exit || finished || step >= s.steps) return
    const timer = setTimeout(() => setStep(old => Math.min(s.steps, old + 1)), s.autoSeconds * 1000)
    return () => clearTimeout(timer)
  }, [s, paused, answer, exit, finished, step])
  function audio() {
    if (!item || !set.audio_enabled || !audioOn) return
    if (item.audio) void playBuffer(`${set.id}:${item.card.id}:${item.card.updated_at}`, item.audio).catch(() => {})
    else speak(item.card.word, { voice })
  }
  function advance() {
    if (Date.now() - last.current < 250) return
    last.current = Date.now()
    if (answer) { stopPlayback(); setPosition(p => p + 1); setStep(0); setAnswer(false) }
    else setStep(old => Math.min(s.steps, old + 1))
  }
  return <GameShell teacher={teacher} title={teacher ? 'スローリビール' : 'ゆっくりみえるゲーム'} onExit={() => setExit(true)} progress={{ current: Math.min(position + 1, queue.length), total: queue.length }} showProgress
    audioEnabled={set.audio_enabled} audioOn={audioOn} onToggleAudio={() => { setAudioOn(!audioOn); stopPlayback() }}>
    {finished ? <section className="flex flex-1 flex-col items-center justify-center gap-5 p-6"><Celebration /><h2 className="text-3xl font-bold">おしまい！</h2><Button variant="play" onClick={onExit}>ゲームえらびへ</Button></section> : <>
      <RevealStage imageUrl={item.imageUrl!} direction={s.direction} steps={s.steps} currentStep={answer ? s.steps : step} />
      <div className="reveal-lamps" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={(answer ? 8 : Math.ceil(step / s.steps * 8)) > i ? 'lit' : ''} />)}</div>
      <div className={`reveal-answer my-3 min-h-12 text-center ${answer ? 'reveal-answer--shown' : ''}`} aria-live="polite">
        {answer && set.mode !== 'elementary' && s.answerDisplay !== 'image' ? <p className="game-word text-4xl font-bold">{item.card.word}</p> : <p>{answer ? 'せいかい！' : `${step} / ${s.steps}`}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {answer ? <Button variant="play" size="xl" onClick={advance}>つぎへ</Button> : <>
          <Button variant="paper" size="xl" onClick={advance} disabled={step >= s.steps}>{teacher ? '少しひらく' : 'すこし ひらく'}</Button>
          <Button variant="play" size="xl" onClick={() => { setAnswer(true); if (s.answerDisplay === 'image_word_audio') audio() }}>せいかい を みる</Button>
          {s.advance === 'auto' && <Button variant="paper" onClick={() => setPaused(!paused)}>{teacher ? (paused ? '再開' : '一時停止') : (paused ? 'つづける' : 'とめる')}</Button>}
          {teacher && <Button variant="paper" onClick={() => setStep(s.steps)}>ぜんぶ見せる</Button>}
        </>}
        {answer && set.audio_enabled && <Button variant="paper" disabled={!audioOn} onClick={audio}><GameIcon name="sound" />きく</Button>}
      </div>
    </>}
    <Dialog game danger open={exit} title="ゲームをやめますか？" onCancel={() => setExit(false)} onConfirm={onExit} confirmLabel="やめる" cancelLabel="つづける">{teacher ? 'ゲームえらびへ戻ります。' : 'ゲームえらびへ もどるよ。'}</Dialog>
  </GameShell>
}
