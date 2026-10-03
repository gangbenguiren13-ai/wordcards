import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCards, getSet } from '@/api/sets'
import { AppHeader } from '@/components/AppHeader'
import { LoadError } from '@/components/LoadError'
import { Spinner } from '@/components/ui'
import { hasBlockingError, validateSet } from '@/lib/validation'
import type { GameId } from '@/types'
import { GameIcon, type GameIconName } from '@/components/GameIcon'
import { Mascot } from '@/components/mascot/Mascot'
import '@/styles/teacherStage.css'

interface GameCard {
  id: GameId
  name: string
  icon: GameIconName
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
    icon: 'cards',
    summary: 'カードを1枚ずつ大きく見せる。言えなかったカードに★を付けて、その場でもう一度出せる。',
    ready: true,
  },
  {
    id: 'memory',
    name: '神経衰弱',
    icon: 'star',
    summary: '裏返したカードから同じ組を探す。ペアやチーム対抗にも使える。',
    ready: true,
  },
  {
    id: 'slowreveal',
    name: 'Slow Reveal',
    icon: 'reveal',
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
      <div className="teacher-stage">
        <AppHeader dark back="/t/home" />
        <LoadError
          retrying={setQuery.isFetching || cardsQuery.isFetching}
          onRetry={() => { void setQuery.refetch(); void cardsQuery.refetch() }}
        />
      </div>
    )
  }

  if (setQuery.isLoading || cardsQuery.isLoading) {
    return (
      <div className="teacher-stage">
        <AppHeader dark back="/t/home" />
        <Spinner />
      </div>
    )
  }

  const set = setQuery.data
  const cards = cardsQuery.data ?? []
  if (!set) {
    return (
      <div className="teacher-stage">
        <AppHeader dark back="/t/home" />
        <p className="p-6 text-center font-bold text-danger-700">
          ⚠ この教材セットは見つかりませんでした。
        </p>
      </div>
    )
  }

  const issues = validateSet({
    title: set.title, mode: set.mode, gamesConfig: set.games_config, cards,
  })
  const blocked = hasBlockingError(issues)
  const empty = cards.length === 0

  return (
    <div className="teacher-stage">
      <AppHeader dark title={set.title} back="/t/home" />
      <main className="teacher-selection">
        <div className="choice-heading">
          <Mascot interactive fetchWhenIdle />
          <h2 className="speech-bubble">ゲームをえらぶ</h2>
        </div>
        <div className="material-badge"><span>{set.title}</span><span>{cards.length}枚・{set.mode === 'elementary' ? '小学校' : '中学校'}</span></div>
        {empty && (
          <p className="teacher-warning">
            <GameIcon name="cards" />
            カードがまだありません。先に教材セットにカードを追加してください。
            <Link to={`/t/sets/${id}/edit`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl border-2 border-line bg-surface p-3">カードを追加する</Link>
          </p>
        )}
        {blocked && (
          <div className="teacher-warning">
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

        <ul className="game-tiles">
          {GAMES.map((g) => {
            const usable = g.ready && !blocked && !empty
            const inner = (
              <>
                <GameIcon name={g.icon} width="48" height="48" />
                <span>{g.name}</span>
                  {!g.ready && (
                    <span className="ml-auto rounded-lg bg-line px-2 py-1 text-xs font-bold text-ink-soft">
                      準備中
                    </span>
                  )}
                <p className="teacher-game-summary">{g.summary}</p>
              </>
            )
            return (
              <li key={g.id}>
                {usable ? (
                  <Link
                    to={`/t/sets/${id}/play/${g.id}`}
                    className={`game-tile game-tile--${g.id === 'flashcards' ? 'flash' : g.id}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div aria-disabled="true" className={`game-tile game-tile--${g.id === 'flashcards' ? 'flash' : g.id} teacher-game-disabled`}>
                    {inner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
