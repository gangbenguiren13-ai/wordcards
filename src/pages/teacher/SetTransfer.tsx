import { LoadingProgress } from '@/components/LoadingProgress'
import { ActionError } from '@/components/ActionError'
import { useToast } from '@/components/toast/useToast'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui'
import { exportSet, importJob, runImport, type ImportJob } from '@/api/transfer'
import { readArchiveFile, type ArchivePreview } from '@/lib/setArchive'
import { SLOTS } from '@/lib/bulkImport'
import { SET_MODE_LABELS } from '@/types'
import { useLeaveWarning } from './BulkImport'

export function SetTransferPage() {
  const { id } = useParams()
  const toast = useToast()
  const [retry, setRetry] = useState<(() => void) | undefined>(undefined)
  const { user } = useAuth()
  const qc = useQueryClient()
  const [preview, setPreview] = useState<ArchivePreview | null>(null)
  const [artifact, setArtifact] = useState<{ blob: Blob; name: string } | null>(null)
  const [withoutMedia, setWithoutMedia] = useState(false)
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [note, setNote] = useState('')
  const [error, setErrorState] = useState('')
  function setError(message: string) { setErrorState(message); if (message) toast.show(message) }
  const [job, setJob] = useState<ImportJob | null>(null)
  useLeaveWarning(!!job && !complete)
  async function prepareExport(media: boolean) {
    if (!id || busy) return
    setRetry(() => () => void prepareExport(media))
    setBusy(true); setError(''); setArtifact(null); setNote('教材を読み込んでいます…')
    try { setArtifact(await exportSet(id, media, setNote)); setNote('ファイルを用意しました。下の「ファイルを保存」を押してください。') }
    catch (e) { setNote(''); setError(`書き出しを完了できませんでした。${(e as Error).message} 通信を確認して再試行してください。`) }
    finally { setBusy(false) }
  }
  async function load(file?: File) {
    if (!file || busy || job) return
    setRetry(() => () => void load(file))
    setBusy(true); setError(''); setPreview(null); setWithoutMedia(false); setNote('ファイルを確認しています…')
    try { const result = await readArchiveFile(file); setPreview(result); setNote('内容を確認して「新しい教材として読み込む」を押してください。') }
    catch (e) { setNote(''); setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function restore() {
    if (!preview || !user || busy) return
    setRetry(() => () => void restore())
    setBusy(true); setError('')
    try {
      const activeJob = job ?? importJob(user.id, crypto.randomUUID(), preview.rows, preview)
      setJob(activeJob)
      await runImport(activeJob, setNote)
      await qc.invalidateQueries({ queryKey: ['sets'] }); setComplete(true); toast.show('保存しました', 'success')
    } catch (e) { setError(`読み込みが止まりました。${(e as Error).message} 完了した分は保存されています。この画面の「続きから再試行」で再開してください。`) }
    finally { setBusy(false) }
  }
  return <>
    <AppHeader title={id ? '教材を書き出す' : '教材ファイルを読み込む'} back={busy || job ? undefined : id ? `/t/sets/${id}/edit` : '/t/home'} />
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-4 pb-20">
      {busy && <LoadingProgress label={note.replace(/\d+\s*\/\s*\d+枚/, '').replace(/^：/, '') || '教材ファイルを よみこみちゅう'}
        done={Number(note.match(/(\d+)\s*\/\s*(\d+)枚/)?.[1] ?? 0)} total={note.match(/(\d+)\s*\/\s*(\d+)枚/) ? Number(note.match(/(\d+)\s*\/\s*(\d+)枚/)?.[2]) : undefined} />}
      <h1 className="text-2xl font-bold">{id ? '教材のバックアップ' : 'JSON・ZIPから教材を復元'}</h1>
      {id ? <section className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-5">
        <p><strong>ZIP</strong>は単語・設定・画像・関連画像・音声をまとめて保存します。別のPCでの復元にも使えます（100MBまで）。</p>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void prepareExport(true)}>ZIPを用意する（画像・音声付き）</Button>
        <p><strong>JSON</strong>は単語と設定のみを保存します。画像・音声も残す場合はZIPを選んでください。</p>
        <Button disabled={busy} onClick={() => void prepareExport(false)}>JSONを用意する（単語・設定のみ）</Button>
        <p className="text-sm text-ink-soft">復元はホームの「教材ファイルを読み込む」から。共有リンクは引き継がれません。</p>
      </section> : <>
        <p>書き出したWordCardsのJSONまたはZIPを選びます。元の教材はそのまま残り、共有オフの新しい教材ができます。</p>
        <label className="rounded-2xl border-2 border-line bg-surface p-5 font-bold">教材ファイルを選択<input disabled={busy || !!job} type="file" accept=".json,.zip" className="mt-3 block min-h-11 w-full" onChange={e => { void load(e.target.files?.[0]); e.target.value = '' }} /></label>
        {preview && <section className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-5">
          <h2 className="text-xl font-bold">{preview.archive.set.title}</h2>
          <p>{SET_MODE_LABELS[preview.archive.set.mode]}／カード{preview.rows.length}枚／画像・音声{preview.rows.reduce((n, r) => n + SLOTS.filter(s => r.files[s]).length, 0)}個</p>
          <ul className="max-h-64 overflow-auto rounded-lg bg-brand-50 p-3">{preview.rows.map((r, i) => <li key={r.id}>{i + 1}. {r.word || '（単語なし・復元後に編集してください）'}</li>)}</ul>
          {!!preview.missing.length && <label className="flex items-start gap-3 rounded-xl bg-warn-50 p-4"><input type="checkbox" className="mt-1 h-6 w-6" disabled={busy || !!job} checked={withoutMedia} onChange={e => setWithoutMedia(e.target.checked)} /><span>このJSONが参照する画像・音声{preview.missing.length}個は同梱されていません。単語・設定だけを読み込む（画像・音声付きの復元にはZIPが必要です）。</span></label>}
          {!complete && <Button variant="primary" size="lg" disabled={busy || (!!preview.missing.length && !withoutMedia)} onClick={() => void restore()}>{busy ? '読み込み中…' : job ? '続きから再試行' : '新しい教材として読み込む'}</Button>}
        </section>}
      </>}
      {!busy && note && <p role="status" className="rounded-xl bg-brand-50 p-4 font-bold">{note}</p>}
      <ActionError error={error} onRetry={retry} onDismiss={() => setError('')} busy={busy} />
      {artifact && <DownloadLink artifact={artifact} />}
      {complete && job && <Link className="flex min-h-14 items-center justify-center rounded-xl bg-brand-600 p-4 font-bold text-white" to={`/t/sets/${job.setId}/edit`}>読み込んだ教材を開く</Link>}
      {!!job && !busy && !complete && <Link className="p-3 underline" to={`/t/sets/${job.setId}/edit`}>途中まで読み込んだ教材を確認する（再試行はこの画面で）</Link>}
    </main>
  </>
}

function DownloadLink({ artifact }: { artifact: { blob: Blob; name: string } }) {
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(artifact.blob)
    if (link.current) link.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [artifact])
  return <a ref={link} className="flex min-h-14 items-center justify-center rounded-xl bg-brand-600 p-4 font-bold text-white" download={artifact.name.replace(/[\\/:*?"<>|]/g, '_')}>ファイルを保存：{artifact.name}</a>
}
