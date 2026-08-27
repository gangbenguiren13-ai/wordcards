import { useEffect, useState } from 'react'

/** 通信が切れたことを常時知らせる（授業中の切り分けを早くするため） */
export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-warn-500 px-4 py-2 text-center text-sm font-bold text-white"
    >
      ⚠ ネットにつながっていません。読み込み済みのゲームはそのまま続けられます。
    </div>
  )
}
