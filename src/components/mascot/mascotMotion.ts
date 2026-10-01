import { PerspectiveCamera, WebGLRenderer, Mesh, Texture, type Material, type BufferGeometry } from 'three'
import { buildMascot, poseMascot } from './mascot3d'
import type { MascotPose } from './Mascot'

/** This entire module (including three) is fetched only by the idle choice screen. */
export function mountMascot(host: HTMLElement, pose: MascotPose): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
  if (reduced.matches || connection?.saveData || host.closest('[data-screen-mode="classroom"]')) return () => {}
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  const options = { alpha: true, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true } as const
  let renderer: WebGLRenderer
  try {
    const context = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as WebGLRenderingContext | null
    if (!context) return () => {}
    renderer = new WebGLRenderer({ ...options, canvas, context })
  } catch { return () => {} }
  const mascot = buildMascot()
  const camera = new PerspectiveCamera(30, 1, .1, 100)
  camera.position.set(0, .3, 5)
  camera.lookAt(0, .2, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  host.append(canvas)
  let disposed = false, visible = true, ready = false, frame = 0, last = 0, elapsed = 0
  let measuredFrames = 0, measuredMs = 0
  let yaw = 0, targetYaw = 0, cheerStart = pose === 'jump' ? 0 : -Infinity
  let pointer: { id: number; x: number; y: number; yaw: number; dragged: boolean } | undefined
  const baseYaw = pose === 'back' ? Math.PI : pose === 'three4' ? .6 : 0
  const listeners = new AbortController()
  const resize = () => {
    const size = host.getBoundingClientRect()
    if (size.width > 0 && size.height > 0) {
      renderer.setSize(size.width, size.height, false)
      camera.aspect = size.width / size.height
      camera.updateProjectionMatrix()
    }
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    listeners.abort()
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    reduced.removeEventListener('change', preferenceChanged)
    connection?.removeEventListener('change', preferenceChanged)
    const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>()
    mascot.scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    textures.forEach(texture => texture.dispose())
    mascot.scene.clear()
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
    delete host.dataset.mascotReady
  }
  const draw = (now: number) => {
    frame = 0
    if (disposed || document.hidden || !visible) { last = 0; return }
    const delta = last ? now - last : 0
    last = now
    elapsed += delta
    if (delta && measuredFrames < 30) {
      measuredFrames++
      measuredMs += delta
      if (measuredFrames === 30 && measuredMs / 30 > 33) { dispose(); return }
    }
    yaw += (targetYaw - yaw) * (1 - Math.exp(-delta / 110))
    const cheering = elapsed - cheerStart < 1100
    const anim = cheering ? 'cheer' : pose === 'wave' ? 'wave' : 'idle'
    const t = cheering ? (elapsed - cheerStart) / 1100 : elapsed % 3200 / 3200
    poseMascot(mascot, anim, t, baseYaw + yaw)
    try { renderer.render(mascot.scene, camera) } catch { dispose(); return }
    if (!ready) { host.dataset.mascotReady = ''; ready = true }
    frame = requestAnimationFrame(draw)
  }
  const resume = () => {
    if (disposed) return
    if (document.hidden || !visible) {
      cancelAnimationFrame(frame); frame = 0; last = 0
      pointer = undefined; targetYaw = 0
    } else if (!frame) frame = requestAnimationFrame(draw)
  }
  function preferenceChanged() { if (reduced.matches || connection?.saveData) dispose() }
  const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
  const intersectionObserver = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    resume()
  })
  resizeObserver?.observe(host)
  intersectionObserver?.observe(host)
  document.addEventListener('visibilitychange', resume, { signal: listeners.signal })
  window.addEventListener('resize', resize, { signal: listeners.signal })
  reduced.addEventListener('change', preferenceChanged)
  connection?.addEventListener('change', preferenceChanged)
  canvas.addEventListener('webglcontextlost', dispose, { signal: listeners.signal })
  canvas.addEventListener('pointerdown', event => {
    if (pointer || !event.isPrimary || event.button !== 0) return
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, dragged: false }
    canvas.setPointerCapture(event.pointerId)
  }, { signal: listeners.signal })
  canvas.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
    if (Math.hypot(dx, dy) > 8) pointer.dragged = true
    targetYaw = pointer.yaw + dx / Math.max(canvas.clientWidth, 1) * Math.PI * 2
  }, { signal: listeners.signal })
  const release = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return
    if (event.type === 'pointerup' && !pointer.dragged && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 8) cheerStart = elapsed
    pointer = undefined
    targetYaw = 0
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(type, release, { signal: listeners.signal })
  resize()
  resume()
  return dispose
}
