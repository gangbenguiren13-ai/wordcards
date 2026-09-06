import { Button } from '@/components/ui'

/** 読み込み失敗を空の教材や読み込み中と区別し、画面から再試行できるようにする。 */
export function LoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6 text-center">
      <p role="alert" className="font-bold text-danger-700">
        教材を読み込めませんでした。通信を確認して、もう一度お試しください。
      </p>
      <Button onClick={onRetry} disabled={retrying}>
        {retrying ? '読み込み中…' : 'もう一度読み込む'}
      </Button>
    </main>
  )
}
