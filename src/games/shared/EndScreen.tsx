import { Button } from '@/components/ui'
import type { Card } from '@/types'

/**
 * ゲーム終了画面。
 * 「もう1回」までの導線を最短にする。授業では終わった直後にもう一度やることが多い。
 */
export function EndScreen({
  title,
  message,
  reviewCards,
  showWords,
  imageUrlOf,
  onReviewAgain,
  onRestart,
  onFinish,
}: {
  title: string
  message?: string
  reviewCards?: Card[]
  showWords?: boolean
  imageUrlOf?: (card: Card) => string | null
  onReviewAgain?: () => void
  onRestart: () => void
  onFinish: () => void
}) {
  const hasReview = Boolean(reviewCards && reviewCards.length > 0)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">
          {hasReview ? '📕' : '🎉'}
        </p>
        <h2 className="mt-3 text-2xl font-bold">{title}</h2>
        {message && <p className="mt-1 text-ink-soft">{message}</p>}
      </div>

      {hasReview && (
        <section className="rounded-2xl border-2 border-warn-500 bg-warn-50 p-4">
          <h3 className="font-bold text-warn-700">
            ★ もういちど れんしゅう するカード（{reviewCards!.length}枚）
          </h3>
          <ul className="mt-3 flex flex-wrap gap-3">
            {reviewCards!.map((c) => {
              const url = imageUrlOf?.(c) ?? null
              return (
                <li key={c.id} className="flex w-24 flex-col items-center gap-1">
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg border-2 border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-line bg-surface text-xs text-ink-soft">
                      画像なし
                    </span>
                  )}
                  {showWords && <span className="break-all text-center text-sm font-bold">{c.word}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3">
        {hasReview && onReviewAgain && (
          <Button variant="primary" size="xl" block onClick={onReviewAgain}>
            ★ のカードだけ もういちど
          </Button>
        )}
        <Button size="lg" block onClick={onRestart}>
          さいしょから
        </Button>
        <Button size="lg" block onClick={onFinish}>
          おわる
        </Button>
      </div>
    </div>
  )
}
