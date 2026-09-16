import { matchesTitle, recentSets } from '@/lib/recentSets'
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
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
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
  const filtered = list.data?.filter(set => matchesTitle(set.title, search)) ?? []
  const recent = recentSets(sets.data ?? []).filter(set => matchesTitle(set.title, search))

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl p-4">
        <div className="mb-5"><TextField label="セット名でさがす" type="search" placeholder="例：Nature、どうぶつ"
          value={search} onChange={e => setSearch(e.target.value)} /></div>
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
              variant="secondary"
              size="lg"
              className="ml-auto"
              icon="＋"
              onClick={() => setCreating(true)}
            >
              新しい教材セット
            </Button>
          )}
        </div>

        {tab === 'active' && <Link to="/t/import" className="mb-4 inline-flex min-h-11 items-center rounded-xl border-2 border-line bg-surface px-4 font-bold">教材ファイルを読み込む（JSON・ZIP）</Link>}

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

        {tab === 'active' && recent.length > 0 && <section aria-label="最近つかった" className="mb-6">
          <h2 className="mb-3 text-xl font-bold">最近つかった</h2>
          <ul className="grid gap-3 sm:grid-cols-3">{recent.map(set => <li key={set.id} className="rounded-2xl border-2 border-brand-100 bg-brand-50 p-4">
            <h3 className="break-words text-lg font-bold">{set.title}</h3><p className="my-2">{set.card_count}枚・{SET_MODE_LABELS[set.mode]}</p>
            <Link to={`/t/sets/${set.id}/play`} className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-brand-600 bg-brand-600 px-4 text-lg font-bold text-white">▶ あそぶ</Link>
          </li>)}</ul>
        </section>}
        {list.data && <h2 className="mb-3 text-xl font-bold">{tab === 'active' ? 'すべての教材' : 'ゴミ箱'}（{list.data.length}）{search && `・検索結果 ${filtered.length}件`}</h2>}
        {list.data && list.data.length > 0 && filtered.length === 0 && <section className="rounded-2xl border-2 border-dashed border-line p-8 text-center">
          <p aria-hidden="true" className="text-4xl">🔎</p><p className="my-4">見つかりません。検索を変えるか、新しい教材セットを作れます。</p>
          <div className="flex justify-center gap-3"><Button onClick={() => setSearch('')}>検索をクリアする</Button>{tab === 'active' && <Button onClick={() => setCreating(true)}>新しい教材セットを作る</Button>}</div>
        </section>}
        <ul aria-label={tab === 'active' ? '教材セット一覧' : 'ゴミ箱の教材一覧'} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((set) => (
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
                <div className="mt-3 flex flex-col gap-3">
                  <Link to={`/t/sets/${set.id}/play`} className="inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-brand-600 bg-brand-600 px-4 text-lg font-bold text-white">▶ あそぶ</Link>
                  <div className="flex flex-wrap gap-3">
                    <Link to={`/t/sets/${set.id}/edit`} className="inline-flex min-h-11 items-center rounded-xl border-2 border-line px-4 font-bold">教材を編集</Link>
                    <Link to={`/t/sets/${set.id}/share`} className="inline-flex min-h-11 items-center rounded-xl border-2 border-line px-4 font-bold">共有する</Link>
                    <Button aria-label={`${set.title}のその他の操作`} aria-expanded={openMenu === set.id}
                      onClick={() => setOpenMenu(openMenu === set.id ? null : set.id)}>…</Button>
                  </div>
                  {openMenu === set.id && <div aria-label={`${set.title}のその他の操作`} className="flex flex-col gap-3 rounded-xl border-2 border-line p-3" onKeyDown={e => { if (e.key === 'Escape') setOpenMenu(null) }}>
                    <Button disabled={duplicate.isPending} onClick={() => duplicate.mutate(set.id)}>教材を複製</Button>
                    <Link to={`/t/sets/${set.id}/export`} className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-line px-4 font-bold">教材を書き出す</Link>
                    <Button variant="danger" onClick={() => { setOpenMenu(null); setDeleteTarget(set) }}>ゴミ箱に入れる</Button>
                  </div>}
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
