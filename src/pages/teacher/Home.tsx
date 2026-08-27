import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSet,
  duplicateSet,
  listSets,
  listTrash,
  restoreSet,
  softDeleteSet,
  type SetListItem,
} from '@/api/sets'
import { AppHeader } from '@/components/AppHeader'
import { Button, Dialog, Spinner, TextField } from '@/components/ui'
import { SET_MODE_LABELS, type SetMode } from '@/types'
import { SETS_WARN_LIMIT, TRASH_RETENTION_DAYS } from '@/lib/constants'

export function HomePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'active' | 'trash'>('active')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newMode, setNewMode] = useState<SetMode>('elementary')
  const [deleteTarget, setDeleteTarget] = useState<SetListItem | null>(null)

  const sets = useQuery({ queryKey: ['sets'], queryFn: listSets })
  const trash = useQuery({
    queryKey: ['trash'],
    queryFn: listTrash,
    enabled: tab === 'trash',
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['sets'] })
    void qc.invalidateQueries({ queryKey: ['trash'] })
  }

  const create = useMutation({
    mutationFn: () => createSet({ title: newTitle.trim(), mode: newMode }),
    onSuccess: (set) => {
      setCreating(false)
      setNewTitle('')
      invalidate()
      navigate(`/t/sets/${set.id}/edit`)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => softDeleteSet(id),
    onSuccess: () => {
      setDeleteTarget(null)
      invalidate()
    },
  })

  const restore = useMutation({
    mutationFn: (id: string) => restoreSet(id),
    onSuccess: invalidate,
  })

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateSet(id),
    onSuccess: invalidate,
  })

  const list = tab === 'active' ? sets : trash

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
              教材セット
            </TabButton>
            <TabButton active={tab === 'trash'} onClick={() => setTab('trash')}>
              🗑 ゴミ箱
            </TabButton>
          </div>
          {tab === 'active' && (
            <Button
              variant="primary"
              size="lg"
              className="ml-auto"
              icon="＋"
              onClick={() => setCreating(true)}
            >
              新しい教材セット
            </Button>
          )}
        </div>

        {tab === 'trash' && (
          <p className="mb-4 rounded-xl border-2 border-line bg-surface p-3 text-sm text-ink-soft">
            ゴミ箱の教材は <strong>{TRASH_RETENTION_DAYS}日</strong> 保管され、そのあと自動で完全に削除されます。
          </p>
        )}

        {list.isLoading && <Spinner />}
        {list.isError && (
          <p className="rounded-xl border-2 border-danger-500 bg-danger-50 p-4 font-bold text-danger-700">
            ⚠ 読み込めませんでした。通信を確認して、ページを再読み込みしてください。
          </p>
        )}

        {list.data && list.data.length === 0 && (
          <EmptyState
            trash={tab === 'trash'}
            onCreate={() => setCreating(true)}
          />
        )}

        {sets.data && sets.data.length > SETS_WARN_LIMIT && tab === 'active' && (
          <p className="mb-4 rounded-xl border-2 border-warn-500 bg-warn-50 p-3 text-sm font-bold text-warn-700">
            ！ 教材セットが{sets.data.length}個あります。整理をおすすめします。
          </p>
        )}

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.data?.map((set) => (
            <li key={set.id} className="rounded-2xl border-2 border-line bg-surface p-4">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 break-words text-lg font-bold">{set.title}</h2>
                <span
                  className={[
                    'shrink-0 rounded-lg px-2 py-1 text-xs font-bold',
                    set.mode === 'elementary'
                      ? 'bg-ok-50 text-ok-700'
                      : 'bg-brand-50 text-brand-700',
                  ].join(' ')}
                >
                  {SET_MODE_LABELS[set.mode]}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                カード {set.card_count}枚
                {set.share_enabled && <span className="ml-2 font-bold text-ok-700">● 共有中</span>}
              </p>

              {tab === 'active' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/t/sets/${set.id}/edit`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-brand-600 bg-brand-600 px-4 font-bold text-white"
                  >
                    ひらく
                  </Link>
                  <Button
                    onClick={() => duplicate.mutate(set.id)}
                    disabled={duplicate.isPending}
                    title="複製"
                  >
                    複製
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteTarget(set)}>
                    削除
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    block
                    onClick={() => restore.mutate(set.id)}
                    disabled={restore.isPending}
                  >
                    もとに戻す
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>

      {/* 新規作成 */}
      <Dialog
        open={creating}
        title="新しい教材セット"
        confirmLabel="作る"
        busy={create.isPending}
        onCancel={() => setCreating(false)}
        onConfirm={() => newTitle.trim() && create.mutate()}
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="教材セット名"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例）どうぶつ"
            maxLength={60}
            autoFocus
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold text-ink-soft">どちらで使いますか</legend>
            <div className="flex gap-2">
              {(['elementary', 'junior'] as SetMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewMode(m)}
                  aria-pressed={newMode === m}
                  className={[
                    'min-h-14 flex-1 rounded-xl border-2 font-bold',
                    newMode === m
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line bg-surface',
                  ].join(' ')}
                >
                  {SET_MODE_LABELS[m]}
                  <span className="block text-xs font-normal text-ink-soft">
                    {m === 'elementary' ? '文字を見せない' : '単語と画像を選べる'}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          {create.isError && (
            <p className="text-sm font-bold text-danger-700">
              ⚠ 作成できませんでした。通信を確認してください。
            </p>
          )}
        </div>
      </Dialog>

      {/* 削除確認 */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="ゴミ箱に入れますか？"
        confirmLabel="ゴミ箱に入れる"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      >
        <p>
          「{deleteTarget?.title}」をゴミ箱に入れます。
          {TRASH_RETENTION_DAYS}日以内ならゴミ箱から元に戻せます。共有中のURLはすぐ使えなくなります。
        </p>
      </Dialog>
    </>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        'min-h-11 rounded-xl border-2 px-4 font-bold',
        active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function EmptyState({ trash, onCreate }: { trash: boolean; onCreate: () => void }) {
  if (trash) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center text-ink-soft">
        ゴミ箱は空です。
      </div>
    )
  }
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        📚
      </p>
      <p className="mt-3 font-bold">まだ教材セットがありません</p>
      <p className="mt-1 text-sm text-ink-soft">
        単語と画像をまとめた「教材セット」を作ると、どのゲームでも使えます。
      </p>
      <Button variant="primary" size="lg" className="mt-4" onClick={onCreate}>
        最初の教材セットを作る
      </Button>
    </div>
  )
}
