import { useEffect } from 'react'
import type { SetMode } from '@/types'

/** Start during preparation only. Never delay media preloading or game input. */
export function useGameFont(mode: SetMode | undefined, preparing = true) {
  useEffect(() => {
    if (mode !== 'junior' || !preparing || !document.fonts) return
    void document.fonts.load('700 32px "WordCards Latin"').catch(() => {
      // The platform sans-serif remains usable if the decorative font is unavailable.
    })
  }, [mode, preparing])
}
