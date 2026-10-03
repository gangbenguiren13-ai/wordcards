import { GameIcon } from './GameIcon'
import { Mascot } from './mascot/Mascot'
import { useEffect, useState } from 'react'

export function LoadingProgress({ done = 0, total, label = '教材を よみこみちゅう', unit = '枚', student = false, gameStyle = false, audioEnabled = false }: {
  done?: number; total?: number; label?: string; unit?: string; student?: boolean; gameStyle?: boolean; audioEnabled?: boolean
}) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(timer) }, [])
  if (student || gameStyle) return <div role="status" className="student-loading">
    <Mascot interactive />
    <div className="loading-details">
      <div className="loading-cards" aria-hidden="true">{[0, 1, 2].map(n => <span key={n} style={{ animationDelay: `${n * 160}ms` }}><GameIcon name="cards" width="56" height="56" /></span>)}</div>
      <p>{label}</p><p className="loading-count">{total !== undefined ? `${done}／${total}${student ? 'まい' : unit}` : student ? 'まいすうを かくにんちゅう' : '（枚数を確認中）'}</p>
      <progress aria-label={label} value={total ? done : undefined} max={total || 1} />
      {audioEnabled && <p>きこえたら、まねして いってみよう</p>}
      {slow && <p className="loading-hint">{student ? 'すこし じかんが かかっているよ。つうしんを たしかめてね。' : '時間がかかっています。通信を たしかめてください。'}</p>}
    </div>
  </div>
  return <div role="status" className="flex flex-col items-center gap-3 p-4 text-center">
    <p className="text-xl font-bold">{label} {total !== undefined ? `${done}／${total}${unit}` : '（枚数を確認中）'}</p>
    <progress aria-label={label} className="h-4 w-full max-w-md" value={total ? done : undefined} max={total || 1} />
    {slow && <p>時間がかかっています。通信を たしかめてください。</p>}
  </div>
}
