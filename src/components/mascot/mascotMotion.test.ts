// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BufferGeometry, Material, Mesh, Texture } from 'three'
import { mountMascot } from './mascotMotion'

const mocks = vi.hoisted(() => ({ renderer: {
  render: vi.fn(), setPixelRatio: vi.fn(), setSize: vi.fn(),
  renderLists: { dispose: vi.fn() }, dispose: vi.fn(), forceContextLoss: vi.fn(),
} }))
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: vi.fn(function () { return mocks.renderer }),
}))
let frames: Map<number, FrameRequestCallback>, nextId: number
let media: EventTarget & { matches: boolean }, connection: EventTarget & { saveData: boolean }
let intersection: (entries: { isIntersecting: boolean }[]) => void
let host: HTMLElement
const tick = (time: number) => { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(time)) }
beforeEach(() => {
  frames = new Map(); nextId = 0
  media = Object.assign(new EventTarget(), { matches: false })
  connection = Object.assign(new EventTarget(), { saveData: false })
  vi.stubGlobal('matchMedia', () => media)
  vi.stubGlobal('navigator', { connection })
  vi.stubGlobal('devicePixelRatio', 3)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersection) { intersection = callback }
    observe() {} disconnect() {}
  })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGLRenderingContext)
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn() })
  host = document.createElement('span'); document.body.append(host)
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ width: 280, height: 280 } as DOMRect)
})
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })
it('WebGL不可なら静止画を保ち、rendererを作らない', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
  const stop = mountMascot(host, 'front'); stop()
  expect(host.querySelector('canvas')).toBeNull()
  expect(mocks.renderer.render).not.toHaveBeenCalled()
})
it('最初の30コマ平均が33msを超えたら全GPU資源を一度ずつ破棄する', () => {
  const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
  const materialDispose = vi.spyOn(Material.prototype, 'dispose')
  const textureDispose = vi.spyOn(Texture.prototype, 'dispose')
  const stop = mountMascot(host, 'front')
  tick(100)
  const scene = mocks.renderer.render.mock.calls[0][0]
  const geometries = new Set(), materials = new Set(), textures = new Set()
  scene.traverse((object: Mesh) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
    }
  })
  for (let i = 1; i <= 29; i++) tick(100 + 40 * i)
  expect(host.querySelector('canvas')).not.toBeNull()
  tick(1300)
  expect(host.querySelector('canvas')).toBeNull()
  expect(host.dataset.mascotReady).toBeUndefined()
  expect(frames.size).toBe(0)
  expect(geometryDispose).toHaveBeenCalledTimes(geometries.size)
  expect(materialDispose).toHaveBeenCalledTimes(materials.size)
  expect(textureDispose).toHaveBeenCalledTimes(textures.size)
  stop()
  expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
  expect(mocks.renderer.forceContextLoss).toHaveBeenCalledOnce()
})
it('画面外と非表示タブは描画を止め、再開時は非表示時間を重さの判定に含めない', () => {
  const stop = mountMascot(host, 'front')
  tick(100); intersection([{ isIntersecting: false }])
  expect(frames.size).toBe(0)
  intersection([{ isIntersecting: true }]); tick(10000)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  document.dispatchEvent(new Event('visibilitychange')); tick(20000)
  for (let i = 1; i <= 32; i++) tick(20000 + 16 * i)
  expect(host.querySelector('canvas')).not.toBeNull()
  expect(mocks.renderer.setPixelRatio).toHaveBeenCalledWith(2)
  stop()
})
it('一度だけ遅いコマがあっても、最初の30コマ平均が33ms以下なら3Dを維持する', () => {
  const stop = mountMascot(host, 'front')
  tick(100); tick(166.7)
  for (let i = 1; i <= 29; i++) tick(166.7 + 16.7 * i)
  expect(host.querySelector('canvas')).not.toBeNull()
  expect(mocks.renderer.dispose).not.toHaveBeenCalled()
  stop()
})
it.each(['reduced', 'saveData', 'contextlost'] as const)('表示後の%sで静止画へ戻り、残った描画も止める', reason => {
  const stop = mountMascot(host, 'front'); tick(100)
  if (reason === 'reduced') { media.matches = true; media.dispatchEvent(new Event('change')) }
  if (reason === 'saveData') { connection.saveData = true; connection.dispatchEvent(new Event('change')) }
  if (reason === 'contextlost') host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost'))
  expect(host.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  stop(); expect(mocks.renderer.dispose).toHaveBeenCalledOnce()
})
it('タップで回転ジャンプ、ドラッグで回り、離したら元の角度に戻る', () => {
  const stop = mountMascot(host, 'front'); tick(100)
  const canvas = host.querySelector('canvas')!
  Object.defineProperty(canvas, 'clientWidth', { value: 280 })
  const send = (type: string, x: number) => {
    const event = new MouseEvent(type, { clientX: x, clientY: 100, button: 0 })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    canvas.dispatchEvent(event)
  }
  const scene = mocks.renderer.render.mock.calls[0][0]
  const root = scene.children[0], spin = root.children[0]
  send('pointerdown', 100); send('pointerup', 100)
  for (let i = 1; i <= 25; i++) tick(100 + 16 * i)
  expect(root.position.y).toBeGreaterThan(.2)
  expect(spin.rotation.y).toBeGreaterThan(1)
  for (let i = 26; i <= 80; i++) tick(100 + 16 * i)
  send('pointerdown', 100); send('pointermove', 200)
  for (let i = 81; i <= 100; i++) tick(100 + 16 * i)
  expect(spin.rotation.y).toBeGreaterThan(2)
  send('pointerup', 200)
  for (let i = 101; i <= 160; i++) tick(100 + 16 * i)
  expect(Math.abs(spin.rotation.y)).toBeLessThan(.01)
  stop()
})
