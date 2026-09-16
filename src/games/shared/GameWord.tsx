import { useLayoutEffect, useRef } from 'react'

export type ScreenMode = 'handheld' | 'classroom'
export function fitWordSize(target: number, availableWidth: number, measuredWidth: number) {
  return measuredWidth > availableWidth && availableWidth > 0 ? target * availableWidth / measuredWidth : target
}

/** 8vh/12vhを基準とし、長い固有名詞だけ幅に収まるまで縮める。 */
export function GameWord({ word, mode = 'handheld' }: { word: string; mode?: ScreenMode }) {
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !text.current) return
      const target = window.innerHeight * (mode === 'classroom' ? 0.12 : 0.08)
      text.current.style.fontSize = `${target}px`
      text.current.style.fontSize = `${fitWordSize(target, box.current.clientWidth, text.current.scrollWidth)}px`
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (box.current) observer?.observe(box.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [word, mode])
  return <div ref={box} className="w-full min-w-0 shrink-0 text-center">
    <span ref={text} className="inline-block whitespace-nowrap font-bold leading-tight" style={{ fontSize: mode === 'classroom' ? '12vh' : '8vh' }}>{word}</span>
  </div>
}
