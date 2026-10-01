import { useEffect, useLayoutEffect, useRef } from 'react'

let motion: typeof import('./mascotMotion') | undefined
export type MascotPose = 'front' | 'three4' | 'back' | 'jump' | 'wave'
export function Mascot({ pose = 'front', className = '', interactive = false, fetchWhenIdle = false }: {
  pose?: MascotPose; className?: string; interactive?: boolean; fetchWhenIdle?: boolean
}) {
  const host = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const node = host.current
    if (!interactive || !node) return
    // Preserve the actual retained image, even under no-store/cache pressure.
    // A new img can revalidate its URL when the canvas hides it during startup.
    const src = `/mascot/mascot-${pose}.webp`
    const retained = document.querySelector<HTMLImageElement>(`img[hidden][src="${src}"]`)
    const image = retained ?? new Image(512, 512)
    const parent = image.parentNode, next = image.nextSibling, originalClass = image.className
    if (!retained) image.src = src
    image.alt = ''; image.draggable = false; image.hidden = false
    image.className = `mascot-static ${className}`
    node.prepend(image)
    return () => {
      image.hidden = true; image.className = originalClass
      if (parent) parent.insertBefore(image, next?.parentNode === parent ? next : null)
      else image.remove()
    }
  }, [interactive, pose, className])
  useEffect(() => {
    const node = host.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const allowed = () => !reduced?.matches && !connection?.saveData && !node?.closest('[data-screen-mode="classroom"]')
    if (!interactive || !node || !reduced || !allowed()) return
    let cancelled = false
    let dispose: (() => void) | undefined
    let idle: number | undefined
    const show = () => {
      if (cancelled || !allowed()) return
      if (motion) dispose = motion.mountMascot(node, pose)
      else if (fetchWhenIdle) void import('./mascotMotion').then(module => {
        motion = module
        if (!cancelled && allowed()) dispose = module.mountMascot(node, pose)
      }).catch(() => { /* Keep the retained static image. */ })
    }
    // Only the choice screen may start a fetch, after its first paint.
    const frame = requestAnimationFrame(() => {
      idle = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(show) : window.setTimeout(show, 250)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (idle !== undefined) {
        if (typeof window.requestIdleCallback === 'function') window.cancelIdleCallback(idle)
        else clearTimeout(idle)
      }
      dispose?.()
    }
  }, [interactive, fetchWhenIdle, pose])
  const image = <img src={`/mascot/mascot-${pose}.webp`} alt="" width="512" height="512" draggable={false} className={`mascot-static ${className}`} />
  return interactive ? <span ref={host} className="mascot-interactive" aria-hidden="true" /> : image
}
