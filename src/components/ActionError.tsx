import { Button } from './ui'
import { toJapaneseError } from '@/lib/errorMessage'

/** 操作のすぐ下に置く。自動では消さず、再試行・閉じる操作を用意する。 */
export function ActionError({ error, onRetry, onDismiss, busy }: {
  error: unknown; onRetry?: () => void; onDismiss: () => void; busy?: boolean
}) {
  if (!error) return null
  return <div role="alert" className="mt-3 flex flex-col gap-3 rounded-xl border-2 border-danger-500 bg-danger-50 p-3 text-danger-700">
    <p className="font-bold">⚠ {typeof error === 'string' ? error : toJapaneseError(error)}</p>
    <div className="flex flex-wrap gap-3">
      {onRetry && <Button disabled={busy} onClick={onRetry}>もう一度ためす</Button>}
      <Button disabled={busy} onClick={onDismiss}>メッセージを閉じる</Button>
    </div>
  </div>
}

export function MutationError<T>({ mutation }: { mutation: {
  error: unknown; isPending: boolean; variables: T | undefined
  mutate: (variables: T) => void; reset: () => void
} }) {
  return <ActionError error={mutation.error} busy={mutation.isPending}
    onRetry={() => mutation.mutate(mutation.variables as T)} onDismiss={mutation.reset} />
}
