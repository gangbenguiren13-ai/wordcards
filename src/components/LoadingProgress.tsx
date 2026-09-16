import { useEffect, useState } from 'react'

export function LoadingProgress({ done = 0, total, label = '教材を よみこみちゅう', unit = '枚' }: {
  done?: number; total?: number; label?: string; unit?: string
}) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(timer) }, [])
  return <div role="status" className="flex flex-col items-center gap-3 p-4 text-center">
    <p className="text-xl font-bold">{label} {total !== undefined ? `${done}／${total}${unit}` : '（枚数を確認中）'}</p>
    <progress aria-label={label} className="h-4 w-full max-w-md" value={total ? done : undefined} max={total || 1} />
    {slow && <p>時間がかかっています。通信を たしかめてください。</p>}
  </div>
}
