import { SharedError } from '@/api/shared'
import { Button } from '@/components/ui'

export function StudentLoadError({ error, retrying = false, onRetry }: {
  error: unknown; retrying?: boolean; onRetry: () => void
}) {
  const unavailable = error instanceof SharedError && error.code === 'NOT_FOUND'
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6 text-center">
    <span aria-hidden="true" className="text-5xl">{unavailable ? '🔎' : '📡'}</span>
    <h1 className="text-2xl font-bold">{unavailable ? 'QRコードを たしかめよう' : 'よみこめませんでした'}</h1>
    <p role="alert" className="text-xl">{error instanceof SharedError ? error.message : '通信を たしかめて、もういちど。'}</p>
    {!unavailable && <Button size="xl" disabled={retrying} onClick={onRetry}>もういちど よみこむ</Button>}
  </main>
}
