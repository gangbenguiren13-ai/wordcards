import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCards, getSet, softDeleteSet, updateSet } from '@/api/sets'
import {
  attachAudio,
  attachImage,
  createCard,
  deleteCard,
  detachMedia,
  reorderCards,
  updateCard,
} from '@/api/cards'
import { useSignedUrls } from '@/api/useSignedUrls'
import { useAuth } from '@/auth/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { Button, Dialog, IssuePanel, Spinner, TextField, Toggle } from '@/components/ui'
import { CardRow } from './CardRow'
import { validateSet, type Issue } from '@/lib/validation'
import { DISPLAY_MODE_LABELS, type Card, type DisplayMode } from '@/types'
import { CARDS_HARD_LIMIT } from '@/lib/constants'
import { normalizeWord } from '@/lib/normalize'
import { useToast } from '@/components/toast/useToast'
import { TRASH_RETENTION_DAYS } from '@/lib/constants'

export function SetEditPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [deleteSetOpen, setDeleteSetOpen] = useState(false)
  const [transientIssues, setTransientIssues] = useState<Issue[]>([])
  const [busyCardId, setBusyCardId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null)
  const [uploadNote, setUploadNote] = useState<string | null>(null)

  const setQuery = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cardsQuery = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data])
  const urls = useSignedUrls(cards.flatMap((c) => [c.image_path, c.audio_path]))

  const refreshCards = () => qc.invalidateQueries({ queryKey: ['cards', id] })
  const refreshSet = () => qc.invalidateQueries({ queryKey: ['set', id] })

  const patchSet = useMutation({
    mutationFn: (patch: Parameters<typeof updateSet>[1]) => updateSet(id, patch),
    onSuccess: () => {
      void refreshSet()
      toast.show('保存しました', 'success')
    },
  })

  const removeSet = useMutation({
    mutationFn: () => softDeleteSet(id),
    onSuccess: () => {
      toast.show('ゴミ箱に入れました', 'success')
      navigate('/t/home')
    },
  })

  const addCard = useMutation({
    mutationFn: () => createCard(id, '', cards.length),
    onSuccess: () => void refreshCards(),
  })

  const editCard = useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: Partial<Card> }) =>
      updateCard(cardId, patch),
    onSuccess: () => void refreshCards(),
  })

  const removeCard = useMutation({
    mutationFn: (card: Card) => deleteCard(card),
    onSuccess: () => {
      setDeleteTarget(null)
      void refreshCards()
    },
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderCards(ids),
    onSuccess: () => void refreshCards(),
  })

  async function handleImage(card: Card, file: File) {
    if (!user) return
    setBusyCardId(card.id)
    setUploadNote(null)
    try {
      const r = await attachImage(user.id, card, file)
      setUploadNote(
        `「${file.name}」を取り込みました（${Math.round(r.originalBytes / 1024)}KB → ${Math.round(r.storedBytes / 1024)}KB）`,
      )
      await refreshCards()
    } catch (e) {
      setTransientIssues((prev) => [
        ...prev,
        {
          level: 'error',
          code: 'UNSUPPORTED_FORMAT',
          message: `「${file.name}」を取り込めませんでした：${(e as Error).message}`,
        },
      ])
    } finally {
      setBusyCardId(null)
    }
  }

  async function handleAudio(card: Card, file: File) {
    if (!user) return
    setBusyCardId(card.id)
    try {
      await attachAudio(user.id, card, file)
      await refreshCards()
    } finally {
      setBusyCardId(null)
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...cards]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next.map((c) => c.id))
  }

  function sortAlphabetically() {
    const sorted = [...cards].sort((a, b) =>
      normalizeWord(a.word).localeCompare(normalizeWord(b.word)),
    )
    reorder.mutate(sorted.map((c) => c.id))
  }

  function shuffleAndFix() {
    const shuffled = [...cards]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    reorder.mutate(shuffled.map((c) => c.id))
  }

  const set = setQuery.data
  const issues = useMemo(() => {
    if (!set) return []
    return [
      ...transientIssues,
      ...validateSet({
        title: set.title,
        mode: set.mode,
        gamesConfig: set.games_config,
        cards,
      }),
    ]
  }, [set, cards, transientIssues])

  if (setQuery.isLoading || cardsQuery.isLoading) {
    return (
      <>
        <AppHeader back="/t/home" />
        <Spinner />
      </>
    )
  }
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

  return (
    <>
      <AppHeader title={set.title} back="/t/home" />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-24">
        {/* ---------- 基本設定 ---------- */}
        <section className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-4">
          <h2 className="text-lg font-bold">基本の設定</h2>
          <TextField
            label="教材セット名"
            defaultValue={set.title}
            maxLength={60}
            onBlur={(e) => {
              const v = e.target.value.trim()
              // 空のまま離れた場合、DB側は1文字以上を要求するので保存できない。
              // 黙って無視すると「入力欄は空なのに保存済み」に見えてしまうので、
              // 元の名前を書き戻して状態を一致させる
              if (!v) {
                e.target.value = set.title
                return
              }
              if (v !== set.title) patchSet.mutate({ title: v })
            }}
          />

          {set.mode === 'junior' ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink-soft">カードの見せ方（既定）</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(DISPLAY_MODE_LABELS) as DisplayMode[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={set.default_display === d}
                    onClick={() => patchSet.mutate({ default_display: d })}
                    className={[
                      'min-h-14 rounded-xl border-2 px-3 font-bold',
                      set.default_display === d
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-line bg-surface',
                    ].join(' ')}
                  >
                    {DISPLAY_MODE_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-ok-500 bg-ok-50 p-3 text-sm">
              <strong className="text-ok-700">小学校モード</strong>
              <span className="text-ink-soft">
                {' '}
                — 生徒の画面には英単語を表示しません（イラストと音声で活動します）。
              </span>
            </div>
          )}

          {set.mode === 'elementary' && (
            <Toggle
              label="正解のときだけ単語を見せる"
              description="ふだんは絵だけ。答え合わせのときに英単語を出します。"
              checked={set.show_word_on_answer}
              onChange={(v) => patchSet.mutate({ show_word_on_answer: v })}
            />
          )}

          <Toggle
            label="音声を使う"
            description="カードに登録した発音を、ゲーム中に鳴らせるようにします。"
            checked={set.audio_enabled}
            onChange={(v) => patchSet.mutate({ audio_enabled: v })}
          />
        </section>

        {/* ---------- 確認事項 ---------- */}
        <IssuePanel issues={issues} />
        {uploadNote && (
          <p className="rounded-xl border-2 border-ok-500 bg-ok-50 p-3 text-sm font-bold text-ok-700">
            ✓ {uploadNote}
          </p>
        )}

        {/* ---------- カード ---------- */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">カード（{cards.length}枚）</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button onClick={sortAlphabetically} disabled={cards.length < 2}>
                A→Z
              </Button>
              <Button onClick={shuffleAndFix} disabled={cards.length < 2}>
                シャッフルして固定
              </Button>
              <Link
                to={`/t/sets/${id}/import`}
                className="inline-flex min-h-11 items-center rounded-xl border-2 border-line bg-surface px-4 font-bold"
              >
                一括登録
              </Link>
            </div>
          </div>

          {cards.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-ink-soft">
              まだカードがありません。「＋ カードを追加」から始めてください。
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {cards.map((card, index) => (
              <CardRow
                key={card.id}
                card={card}
                index={index}
                total={cards.length}
                imageUrl={card.image_path ? urls.data?.[card.image_path] : undefined}
                audioUrl={card.audio_path ? urls.data?.[card.audio_path] : undefined}
                busy={busyCardId === card.id}
                onWordChange={(word) =>
                  editCard.mutate({ cardId: card.id, patch: { word } })
                }
                onPickImage={(file) => void handleImage(card, file)}
                onPickAudio={(file) => void handleAudio(card, file)}
                onRemoveImage={() => void detachMedia(card, 'image').then(refreshCards)}
                onRemoveAudio={() => void detachMedia(card, 'audio').then(refreshCards)}
                onMove={(d) => move(index, d)}
                onDelete={() => setDeleteTarget(card)}
                onFileRejected={(issue) => setTransientIssues((p) => [...p, issue])}
              />
            ))}
          </ul>

          <Button
            variant="primary"
            size="lg"
            block
            icon="＋"
            onClick={() => addCard.mutate()}
            disabled={addCard.isPending || cards.length >= CARDS_HARD_LIMIT}
          >
            カードを追加
          </Button>
          {cards.length >= CARDS_HARD_LIMIT && (
            <p className="text-center text-sm font-bold text-danger-700">
              ⚠ 1つの教材セットに入れられるのは{CARDS_HARD_LIMIT}枚までです。
            </p>
          )}
        </section>

        {transientIssues.length > 0 && (
          <Button onClick={() => setTransientIssues([])}>メッセージを消す</Button>
        )}

        <Link
          to={`/t/sets/${id}/play`}
          className="inline-flex min-h-16 items-center justify-center rounded-xl border-2 border-brand-600 bg-brand-600 px-6 text-lg font-bold text-white"
        >
          ▶ ゲームをはじめる
        </Link>

        <Link to={`/t/sets/${id}/share`} className="inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-brand-600 p-3 font-bold text-brand-700">生徒に共有（リンク・QRコード）</Link>

        {/* セット全体の削除は、カードの操作から離れた最下部に置く。
            編集中に押してしまう事故を防ぐため、色も控えめにしておく */}
        <section className="mt-6 border-t-2 border-line pt-4">
          <Button variant="danger" onClick={() => setDeleteSetOpen(true)}>
            この教材セットを削除
          </Button>
        </section>
      </main>

      <Dialog
        open={deleteSetOpen}
        title="この教材セットをゴミ箱に入れますか？"
        confirmLabel="ゴミ箱に入れる"
        danger
        busy={removeSet.isPending}
        onCancel={() => setDeleteSetOpen(false)}
        onConfirm={() => removeSet.mutate()}
      >
        <p>
          「{set.title}」とカード{cards.length}枚をゴミ箱に入れます。
          {TRASH_RETENTION_DAYS}日以内ならホーム画面のゴミ箱から元に戻せます。
        </p>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title="このカードを削除しますか？"
        confirmLabel="削除する"
        danger
        busy={removeCard.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeCard.mutate(deleteTarget)}
      >
        <p>
          「{deleteTarget?.word || '（単語なし）'}」を削除します。画像と音声もいっしょに消えます。
        </p>
      </Dialog>
    </>
  )
}
