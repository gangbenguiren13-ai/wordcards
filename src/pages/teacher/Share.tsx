import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { getCards, getSet, issueShareToken, updateSet } from '@/api/sets'
import { AppHeader } from '@/components/AppHeader'
import { LoadError } from '@/components/LoadError'
import { Button, Dialog, Spinner } from '@/components/ui'
import { hasBlockingError, validateSet } from '@/lib/validation'
import { selectUsableCards } from '@/lib/usableCards'
import { effectiveDisplay } from '@/games/flashcards/settings'
import { FLASHCARDS_DEFAULTS } from '@/lib/gameDefaults'
import { toJapaneseError } from '@/lib/errorMessage'

export function ShareQr({ url }: { url: string }) {
  const qr = useMemo(() => QRCode.create(url, { errorCorrectionLevel: 'M' }).modules, [url])
  const path = Array.from(qr.data).flatMap((dark, i) => dark
    ? [`M${i % qr.size + 4} ${Math.floor(i / qr.size) + 4}h1v1h-1z`] : []).join('')
  return <svg role="img" aria-label="生徒用共有リンクのQRコード" viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
    width="440" height="440" className="mx-auto h-auto w-full max-w-[440px]" shapeRendering="crispEdges">
    <rect width="100%" height="100%" fill="white" /><path d={path} fill="black" />
  </svg>
}

export function SharePage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [notice, setNotice] = useState('')
  const setQuery = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cardsQuery = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })
  const action = useMutation({
    mutationFn: async (kind: 'enable' | 'stop' | 'rotate') => {
      if (kind === 'stop') { await updateSet(id, { share_enabled: false }); return }
      // 保存中の編集や別タブの変更も含め、共有直前に最新データを検査する。
      const [latest, cards] = await Promise.all([getSet(id), getCards(id)])
      const settings = { ...FLASHCARDS_DEFAULTS, ...latest.games_config.flashcards?.defaults }
      if (latest.deleted_at || hasBlockingError(validateSet({ title: latest.title, mode: latest.mode,
        gamesConfig: latest.games_config, cards })) || !latest.games_config.flashcards?.enabledForStudents
        || !selectUsableCards(cards, effectiveDisplay(latest, settings)).usable.length) {
        throw new Error('共有できるフラッシュカードがありません。教材とゲーム設定を確認してください。')
      }
      if (kind === 'rotate' || !latest.share_token) await issueShareToken(id)
      else await updateSet(id, { share_enabled: true })
    },
    onSuccess: async (_, kind) => {
      setConfirmRotate(false)
      setNotice(kind === 'stop' ? '共有を停止しました。' : kind === 'rotate' ? '新しいURLに変わりました。配り直してください。' : '共有を開始しました。')
      await Promise.all([qc.invalidateQueries({ queryKey: ['set', id] }), qc.invalidateQueries({ queryKey: ['sets'] })])
    },
  })
  const set = setQuery.data
  const header = <AppHeader title="生徒に共有" back={`/t/sets/${id}/edit`} />
  if (setQuery.isError || cardsQuery.isError) return <>{header}<LoadError retrying={setQuery.isFetching || cardsQuery.isFetching}
    onRetry={() => { void setQuery.refetch(); void cardsQuery.refetch() }} /></>
  if (!set || !cardsQuery.data) return <>{header}<Spinner /></>
  const url = set.share_token ? `${window.location.origin}/p/${set.share_token}` : ''
  const blocked = Boolean(set.deleted_at) || hasBlockingError(validateSet({ title: set.title, mode: set.mode,
    gamesConfig: set.games_config, cards: cardsQuery.data })) || !set.games_config.flashcards?.enabledForStudents
  return <>{header}<main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12">
    <h1 className="text-xl font-bold">{set.title}</h1>
    <p>生徒はログインせずに、QRコードかリンクからフラッシュカードを使えます。</p>
    {notice && <p role="status" className="font-bold">{notice}</p>}
    {action.isError && <p role="alert" className="font-bold text-danger-700">{toJapaneseError(action.error)}</p>}
    {blocked && <p role="alert">共有前に、教材の未入力・ゲームの公開設定を確認してください。</p>}
    <p className="text-lg font-bold">{set.share_enabled ? '共有中' : '共有停止中'}</p>
    {set.share_enabled && url && <>
      <ShareQr url={url} />
      <label className="flex flex-col gap-2 font-bold">生徒用リンク
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-xl border-2 border-line p-3 text-sm" />
      </label>
      <Button onClick={async () => {
        try { await navigator.clipboard.writeText(url); setNotice('リンクをコピーしました。ロイロノートなどに貼り付けてください。') }
        catch { setNotice('自動コピーできませんでした。リンク欄を選んでコピーしてください。') }
      }}>リンクをコピー</Button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-center font-bold underline">生徒用ページを確認する</a>
    </>}
    <Button variant="primary" disabled={action.isPending || (!set.share_enabled && blocked)}
      onClick={() => action.mutate(set.share_enabled ? 'stop' : 'enable')}>
      {action.isPending ? '処理中…' : set.share_enabled ? '共有を停止する' : set.share_token ? '同じリンクで共有を再開する' : '共有リンク・QRコードを作る'}
    </Button>
    {set.share_token && <Button disabled={action.isPending || blocked} onClick={() => setConfirmRotate(true)}>URLを作り直す</Button>}
    <p className="text-sm text-ink-soft">リンクは授業で使う相手にだけ配ってください。停止・作り直し後は古いリンクから新しく開けなくなります。すでに開いて読み込んだ教材は、その端末では続けて使える場合があります。</p>
  </main><Dialog open={confirmRotate} title="URLを作り直しますか？" confirmLabel="作り直して共有する"
    busy={action.isPending} onCancel={() => setConfirmRotate(false)} onConfirm={() => action.mutate('rotate')}>
    前のURL・QRコードは使えなくなります。新しいリンクを生徒に配り直してください。
  </Dialog></>
}
