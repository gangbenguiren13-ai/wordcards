import type { SVGProps } from 'react'

export type GameIconName = 'sound' | 'muted' | 'star' | 'play' | 'check' | 'cards' | 'left' | 'right' | 'search' | 'warning' | 'sparkles' | 'reveal'
const paths: Record<GameIconName, string> = {
  sound: 'M11 4 6 8H2v8h4l5 4V4Zm4 4c2 2 2 6 0 8m3-11c4 4 4 10 0 14',
  muted: 'M11 4 6 8H2v8h4l5 4V4Zm5 5 6 6m0-6-6 6',
  star: 'm12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3L5.8 21l1.2-6.8-5-5 6.9-1L12 2Z',
  play: 'm7 3 14 9-14 9V3Z',
  check: 'm4 12 5 5L20 6',
  cards: 'M7 3h13v17H7V3ZM4 6H2v16h13v-2',
  left: 'm14 4-8 8 8 8M6 12h16',
  right: 'm10 4 8 8-8 8M2 12h16',
  search: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm6 14 6 6',
  warning: 'm12 2 10 19H2L12 2Zm0 6v6m0 3v1',
  sparkles: 'm12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z',
  reveal: 'M3 4h18v16H3V4Zm0 8h18M12 4v16',
}

/** All icons are decorative; the button or adjacent text supplies the name. */
export function GameIcon({ name, filled = false, className = '', ...props }: {
  name: GameIconName; filled?: boolean
} & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"
    className={`game-icon ${className}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d={paths[name]} /></svg>
}
