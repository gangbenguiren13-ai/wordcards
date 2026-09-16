import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCards, getSet } from '@/api/sets'
import { AppHeader } from '@/components/AppHeader'
import { LoadError } from '@/components/LoadError'
import { Spinner } from '@/components/ui'
import { hasBlockingError, validateSet } from '@/lib/validation'
import type { GameId } from '@/types'

interface GameCard {
  id: GameId
  name: string
  icon: string
  summary: string
  ready: boolean
}

/**
 * ゲームの一覧。
 *
 * 似た活動（Slow Reveal と Hidden Card など）を教師が取り違えないよう、
 * 名前だけでなく「何がどう違うか」を一行で添える。
 */
const GAMES: GameCard[] = [
  {
    id: 'flashcards',
    name: 'フラッシュカード',
    icon: '🃏',
    summary: 'カードを1枚ずつ大きく見せる。言えなかったカードに★を付けて、その場でもう一度出せる。',
    ready: true,
  },
  {
    id: 'memory',
    name: '神経衰弱',
    icon: '🔄',
    summary: '裏返したカードから同じ組を探す。ペアやチーム対抗にも使える。',
    ready: true,
  },
  {
    id: 'slowreveal',
    name: 'Slow Reveal',
    icon: '🌅',
    summary: '画像を一方向からだんだん見せて、全部見える前に単語を当てる。',
    ready: true,
  },
]

export function PlaySelectPage() {
  const { id = '' } = useParams()
  const setQuery = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cardsQuery = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })

  if (setQuery.isError || cardsQuery.isError) {
    return (
      <>
        <AppHeader back="/t/home" />
        <LoadError
          retrying={setQuery.isFetching || cardsQuery.isFetching}
          onRetry={() => { void setQuery.refetch(); void cardsQuery.refetch() }}
        />
      </>
    )
  }

  if (setQuery.isLoading || cardsQuery.isLoading) {
    return (
      <>
        <AppHeader back="/t/home" />
        <Spinner />
      </>
    )
  }

  const set = setQuery.data
  const cards = cardsQuery.data ?? []
  if (!set) {
    return (
      <>
        <AppHeader back="/t/home" />
        <p className="p-6 text-center font-bold text-danger-700">
          ⚠ この教材セットは見つかりませんでした。
        </p>
      </>
    )
  }

  const issues = validateSet({
    title: set.title, mode: set.mode, gamesConfig: set.games_config, cards,
  })
  const blocked = hasBlockingError(issues)
  const empty = cards.length === 0

  return (
    <>
      <AppHeader title={set.title} back="/t/home" />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        {empty && (
          <p className="rounded-xl border-2 border-warn-500 bg-warn-50 p-4 font-bold text-warn-700">
            ！ カードがまだありません。先に教材セットにカードを追加してください。
          </p>
        )}
        {blocked && (
          <div className="rounded-xl border-2 border-danger-500 bg-danger-50 p-4">
            <p className="font-bold text-danger-700">⚠ なおすまでゲームを始められません</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {issues.filter((i) => i.level === 'error').map((i, n) => (
                <li key={n}>{i.message}</li>
              ))}
            </ul>
            <Link to={`/t/sets/${id}/edit`} className="mt-3 inline-block font-bold text-brand-600 underline">
              教材セットを直しに行く
            </Link>
          </div>
        )}

        <h2 className="text-lg font-bold">ゲームをえらぶ</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAMES.map((g) => {
            const usable = g.ready && !blocked && !empty
            const inner = (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-3xl" aria-hidden="true">{g.icon}</span>
                  <span className="text-lg font-bold">{g.name}</span>
                  {!g.ready && (
                    <span className="ml-auto rounded-lg bg-line px-2 py-1 text-xs font-bold text-ink-soft">
                      準備中
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-ink-soft">{g.summary}</p>
              </>
            )
            return (
              <li key={g.id}>
                {usable ? (
                  <Link
                    to={`/t/sets/${id}/play/${g.id}`}
                    className="block h-full rounded-2xl border-2 border-brand-500 bg-surface p-4 hover:bg-brand-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="h-full rounded-2xl border-2 border-line bg-surface p-4 opacity-60">
                    {inner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </>
  )
}
