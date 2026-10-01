import type { CSSProperties } from 'react'
import { Mascot } from './mascot/Mascot'

/** Decorative only: mounted on results, never controls progression or playback. */
export function Celebration() {
  return <div className="celebration" aria-hidden="true">
    <div className="confetti">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
    <Mascot interactive pose="jump" className="mascot-jump" />
    <span className="done-stamp">できた！</span>
  </div>
}
