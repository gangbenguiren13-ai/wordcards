import { Celebration } from '@/components/Celebration'
import { GameIcon } from '@/components/GameIcon'
import { Button } from '@/components/ui'
import type { Card } from '@/types'

/**
 * ゲーム終了画面。
 * 「もう1回」までの導線を最短にする。授業では終わった直後にもう一度やることが多い。
 */
export function EndScreen({
  title,
  teacher = false,
  message,
  reviewCards,
  showWords,
  imageUrlOf,
  onReviewAgain,
  onRestart,
  onFinish,
}: {
  title: string
  teacher?: boolean
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
    <div className="game-end mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 rounded-3xl bg-white p-5 text-ink">
      <Celebration />
      <div className="text-center">
        <h2 className="mt-3 text-2xl font-bold">{title}</h2>
        {message && <p className="mt-1 text-ink-soft">{message}</p>}
      </div>

      {hasReview && (
        <section className="rounded-2xl border-2 border-warn-500 bg-warn-50 p-4">
          <h3 className="font-bold text-warn-700">
            <GameIcon name="star" filled /> もういちど れんしゅう するカード（{reviewCards!.length}{teacher ? '枚' : 'まい'}）
          </h3>
          <ul className="review-fan mt-6 flex flex-wrap justify-center gap-3">
            {reviewCards!.map((c) => {
              const url = imageUrlOf?.(c) ?? null
              return (
                <li key={c.id} className="flex w-24 flex-col items-center gap-1 rounded-xl bg-white p-2 text-ink">
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg border-2 border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-line bg-surface text-xs text-ink-soft">
                      {teacher ? '画像なし' : 'がぞう なし'}
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
          <Button variant="play" size="xl" block onClick={onReviewAgain}>
            <GameIcon name="star" filled />のカードだけ もういちど
          </Button>
        )}
        <Button variant="paper" size="lg" block onClick={onRestart}>
          さいしょから
        </Button>
        <Button variant="paper" size="lg" block onClick={onFinish}>
          おわる
        </Button>
      </div>
    </div>
  )
}
