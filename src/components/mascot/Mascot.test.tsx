// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { Mascot } from './Mascot'
import { StrictMode } from 'react'

const mocks = vi.hoisted(() => ({ imported: vi.fn(), mount: vi.fn(), dispose: vi.fn() }))
vi.mock('./mascotMotion', () => { mocks.imported(); return { mountMascot: mocks.mount } })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })
function environment(reduced = false, saveData = false) {
  const idle = vi.fn()
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.stubGlobal('navigator', { connection: { saveData } })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('requestIdleCallback', idle)
  vi.stubGlobal('cancelIdleCallback', vi.fn())
  mocks.mount.mockReturnValue(mocks.dispose)
  return idle
}
it.each(['reduced', 'saveData', 'classroom'] as const)('%sでは3Dの取得を予約せず静止画を保つ', reason => {
  const idle = environment(reason === 'reduced', reason === 'saveData')
  render(<div data-screen-mode={reason === 'classroom' ? 'classroom' : 'handheld'}><Mascot interactive fetchWhenIdle /></div>)
  expect(idle).not.toHaveBeenCalled()
  expect(mocks.imported).not.toHaveBeenCalled()
  expect(mocks.mount).not.toHaveBeenCalled()
  expect(document.querySelector('img')?.getAttribute('alt')).toBe('')
})
it('取得前の読み込み・終了は静止画を保ち、ゲーム選択だけが空き時間に取得する', async () => {
  const idle = environment()
  const loading = render(<Mascot interactive />)
  await act(async () => { idle.mock.calls[0][0]() })
  expect(mocks.imported).not.toHaveBeenCalled()
  loading.unmount()
  idle.mockClear()
  const choice = render(<Mascot interactive fetchWhenIdle />)
  expect(mocks.imported).not.toHaveBeenCalled()
  await act(async () => { idle.mock.calls[0][0]() })
  expect(mocks.imported).toHaveBeenCalledOnce()
  expect(mocks.mount).toHaveBeenCalledOnce()
  choice.unmount()
  expect(mocks.dispose).toHaveBeenCalledOnce()
  idle.mockClear()
  render(<Mascot interactive pose="jump" />)
  await act(async () => { idle.mock.calls[0][0]() })
  expect(mocks.imported).toHaveBeenCalledOnce()
  expect(mocks.mount).toHaveBeenLastCalledWith(expect.any(HTMLElement), 'jump')
})
it('選択画面を離れた後に残った空き時間コールバックが3Dを開始しない', async () => {
  const idle = environment()
  const view = render(<Mascot interactive fetchWhenIdle />)
  const callback = idle.mock.calls[0][0]
  view.unmount()
  await act(async () => { callback() })
  expect(mocks.mount).not.toHaveBeenCalled()
})
it('先読みした画像要素そのものを再利用し、離れると元の場所へ戻す', () => {
  environment(true)
  const retained = document.createElement('img')
  retained.src = '/mascot/mascot-jump.webp'; retained.hidden = true; retained.className = 'hidden'
  document.body.prepend(retained)
  const view = render(<Mascot interactive pose="jump" className="mascot-jump" />)
  expect(document.querySelector('.mascot-interactive img')).toBe(retained)
  expect(retained.hidden).toBe(false)
  view.unmount()
  expect(retained.parentNode).toBe(document.body)
  expect(retained.hidden).toBe(true)
  expect(retained.className).toBe('hidden')
  retained.remove()
})
it('StrictModeの再マウントと入口・終了の往復でも保持画像の同一性と元の場所を維持する', () => {
  environment(true)
  const retained = ['front', 'jump'].map(pose => {
    const image = document.createElement('img')
    image.src = `/mascot/mascot-${pose}.webp`; image.hidden = true; image.className = 'hidden'
    document.body.prepend(image)
    return image
  })
  const view = render(<StrictMode><Mascot interactive /></StrictMode>)
  for (let i = 0; i < 3; i++) {
    expect(document.querySelector('.mascot-interactive img')).toBe(retained[0])
    view.rerender(<StrictMode><Mascot interactive pose="jump" /></StrictMode>)
    expect(document.querySelector('.mascot-interactive img')).toBe(retained[1])
    expect(retained[0].parentNode).toBe(document.body)
    expect(retained[0].hidden).toBe(true)
    view.rerender(<StrictMode><Mascot interactive /></StrictMode>)
  }
  view.unmount()
  for (const image of retained) {
    expect(image.parentNode).toBe(document.body)
    expect(image.hidden).toBe(true)
    expect(image.className).toBe('hidden')
    image.remove()
  }
})
