import { LoadingProgress } from '@/components/LoadingProgress'
import { ActionError } from '@/components/ActionError'
import { useToast } from '@/components/toast/useToast'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCards, getSet } from '@/api/sets'
import { importJob, runImport, type ImportJob } from '@/api/transfer'
import { useAuth } from '@/auth/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { Button, Spinner } from '@/components/ui'
import { checkUploadFile } from '@/lib/validation'
import { normalizeWord } from '@/lib/normalize'
import { CARDS_HARD_LIMIT } from '@/lib/constants'
import { decodeTable, draftRow, existingRows, fileSlot, matchFiles, parseTable, rowError, SLOT_LABELS, SLOTS, slotPath, wordsFromFiles, type DraftRow, type PendingFile, type Slot } from '@/lib/bulkImport'
import { downloadBlob, MAX_ARCHIVE_BYTES, MAX_JSON_BYTES } from '@/lib/setArchive'
import type { Card } from '@/types'

const field = 'min-h-11 w-full rounded-lg border-2 border-line bg-surface p-2'
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
export function LocalPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(file)
    const element = image.current ?? audio.current
    if (element) element.src = next
    return () => URL.revokeObjectURL(next)
  }, [file])
  if (fileSlot(file) === 'audio') return <audio aria-label={`${file.name}の試聴`} ref={audio} controls preload="none" className="max-w-full" />
  return <img ref={image} alt={file.name} className="h-16 w-20 rounded object-contain" />
}
export function BulkImportPage() {
  const { id = '' } = useParams()
  const set = useQuery({ queryKey: ['set', id], queryFn: () => getSet(id) })
  const cards = useQuery({ queryKey: ['cards', id], queryFn: () => getCards(id) })
  if (set.isLoading || cards.isLoading) return <Spinner />
  if (set.isError || cards.isError || !set.data || !cards.data) return <><AppHeader back={`/t/sets/${id}/edit`} /><p role="alert" className="p-6">教材を読み込めませんでした。通信を確認して再読み込みしてください。</p></>
  return <BulkEditor key={id} setId={id} title={set.data.title} initialCards={cards.data} />
}
export function BulkEditor({ setId, title, initialCards }: { setId: string; title: string; initialCards: Card[] }) {
  const toast = useToast()
  const [retry, setRetry] = useState<(() => void) | undefined>(undefined)
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'table' | 'csv' | 'files'>('table')
  const [rows, setRows] = useState<DraftRow[]>(() => [...existingRows(initialCards)])
  const [pending, setPending] = useState<PendingFile[]>([])
  const [paste, setPaste] = useState('')
  const [note, setNote] = useState('')
  const [error, setErrorState] = useState('')
  function setError(message: string) { setErrorState(message); if (message) toast.show(message) }
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [job, setJob] = useState<ImportJob | null>(null)
  const locked = busy || !!job
  const newRows = rows.filter(r => !r.existing)
  const selected = rows.filter(r => r.selected && (!r.existing || SLOTS.some(s => r.files[s])))
  const dirty = !complete && (newRows.some(r => r.word || SLOTS.some(s => r.files[s])) || rows.some(r => SLOTS.some(s => r.files[s])) || !!pending.length)
  useLeaveWarning(dirty)
  const errors = selected.filter(r => rowError(r))
  const replacements = selected.reduce((n, r) => n + SLOTS.filter(s => r.files[s] && r.existing && slotPath(r.existing, s)).length, 0)
  function update(id: string, patch: Partial<DraftRow>) { setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)) }
  function append(additions: DraftRow[]) {
    if (rows.length + additions.length > CARDS_HARD_LIMIT) throw new Error('一覧は200枚までです。別の教材に分けてください。')
    setRows(prev => [...prev, ...additions])
  }
  async function readTable(file?: File) {
    if (!file || locked) return
    setRetry(() => () => void readTable(file))
    setError(''); setBusy(true)
    try {
      if (file.size > MAX_JSON_BYTES) throw new Error('CSV/TSVは2MBまでです。')
      const decoded = decodeTable(new Uint8Array(await file.arrayBuffer()))
      const additions = parseTable(decoded.text)
      append(additions)
      setNote(`${decoded.encoding}で${additions.length}行を読み込みました。下の一覧で確認してください。`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function addFiles(files: File[]) {
    if (locked) return
    setError('')
    const previous = [...rows.flatMap(r => Object.values(r.files)), ...pending.map(p => p.file)]
    if (files.length + previous.length > 600 || [...previous, ...files].reduce((n, f) => n + f.size, 0) > MAX_ARCHIVE_BYTES) { setError('ファイルは合計600個・100MBまでです。分けて登録してください。'); return }
    const result = matchFiles(rows, files)
    setRows(result.rows); setPending(prev => [...prev, ...result.pending])
    setNote(`${files.length - result.pending.length}個を自動対応しました。残りは「要手動対応」で確認できます。`)
  }
  function assign(item: PendingFile, rowId: string, slot: Slot) {
    if (!rowId) return
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const old = row.files[slot]
    update(row.id, { files: { ...row.files, [slot]: item.file } })
    setPending(prev => [...prev.filter(p => p.id !== item.id), ...(old ? [{ id: crypto.randomUUID(), file: old, reason: '対応を変更したファイルです' }] : [])])
  }
  async function save() {
    if (!user || busy) return
    setRetry(() => () => void save())
    setBusy(true); setError('')
    try {
      let activeJob = job
      if (!activeJob) {
        if (errors.length || !selected.length) throw new Error('登録する行のエラーを修正してください。')
        const start = Math.max(-1, ...initialCards.map(c => c.sort_order)) + 1
        let added = 0
        activeJob = importJob(user.id, setId, selected.map(r => ({ ...r, word: r.word.trim(), order: r.existing ? r.order : start + added++ })))
      }
      setJob(activeJob)
      await runImport(activeJob, setNote)
      await Promise.all([qc.invalidateQueries({ queryKey: ['cards', setId] }), qc.invalidateQueries({ queryKey: ['sets'] }), qc.invalidateQueries({ queryKey: ['signed-urls'] })])
      setComplete(true); toast.show('保存しました', 'success')
    } catch (e) { setError(`登録が止まりました。${(e as Error).message} 完了した分は保存されています。「続きから再試行」で再開できます。`) }
    finally { setBusy(false) }
  }
  return <>
    <AppHeader title={`${title}：一括登録`} back={dirty || busy ? undefined : `/t/sets/${setId}/edit`} />
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 pb-24">
      {busy && <LoadingProgress label={note.replace(/\d+\s*\/\s*\d+枚/, '').replace(/^：/, '') || '教材ファイルを よみこみちゅう'}
        done={Number(note.match(/(\d+)\s*\/\s*(\d+)枚/)?.[1] ?? 0)} total={note.match(/(\d+)\s*\/\s*(\d+)枚/) ? Number(note.match(/(\d+)\s*\/\s*(\d+)枚/)?.[2]) : undefined} />}
      <h1 className="text-2xl font-bold">カードをまとめて登録</h1>
      <p>単語やファイルを追加し、下の一覧で確認してから「登録」を押してください。既存のカードには、画像・音声を対応づけられます。</p>
      <fieldset disabled={locked} className="contents">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="入力方法">
          {([['table', '表に入力'], ['csv', 'CSV・TSV'], ['files', '画像・音声をまとめて追加']] as const).map(([value, label]) => <Button role="tab" aria-selected={tab === value} variant={tab === value ? 'primary' : 'secondary'} key={value} onClick={() => setTab(value)}>{label}</Button>)}
        </div>
        <section className="rounded-2xl border-2 border-line bg-surface p-4">
          {tab === 'table' && <div className="flex flex-col gap-3">
            <p>1行に1単語で貼り付けできます。Excelの単語列も、そのまま使えます。</p>
            <textarea aria-label="単語をまとめて貼り付け" rows={4} className={field} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'dog\ncat\nrabbit'} />
            <div className="flex flex-wrap gap-2"><Button onClick={() => { try { append([draftRow()]) } catch (e) { setError((e as Error).message) } }}>＋ 空の行を追加</Button>
              <Button disabled={!paste.trim()} onClick={() => { try { if (paste.includes('\t')) throw new Error('単語の1列だけを貼り付けてください。複数列はCSV・TSVから読み込めます。'); append(paste.split(/\r?\n/).filter(w => w.trim()).map((w, i) => draftRow(w.trim(), i))); setPaste('') } catch (e) { setError((e as Error).message) } }}>貼り付けた単語を一覧に追加</Button></div>
          </div>}
          {tab === 'csv' && <div className="flex flex-col gap-3">
            <p>UTF-8・Shift_JIS対応。先頭行に word が必要です。画像・音声は続けて追加できます。</p>
            <label className="font-bold">CSV・TSVファイル<input type="file" accept=".csv,.tsv,.txt" className="mt-2 block min-h-11 w-full" onChange={e => { void readTable(e.target.files?.[0]); e.target.value = '' }} /></label>
            <Button onClick={() => downloadBlob(new Blob(['\uFEFFword,image_file,pair_image_file,audio_file,sort_order\r\ndog,dog.jpg,,dog.mp3,1\r\ncat,cat.jpg,,cat.mp3,2\r\n'], { type: 'text/csv;charset=utf-8' }), 'wordcards-sample.csv')}>サンプルCSVを保存</Button>
          </div>}
          {tab === 'files' && <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-brand-500 p-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)) }}>
            <p className="font-bold">ここに画像・音声をまとめてドロップ</p>
            <p className="text-sm">画像は1個10MB、音声は1個2MBまで。名前が単語と一致すれば自動対応します。</p>
            <label className="font-bold">画像・音声ファイル<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.mp3,.m4a" className="mt-2 block min-h-11 w-full" onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} /></label>
          </div>}
        </section>
        {pending.length > 0 && <section className="rounded-2xl border-2 border-warn-500 bg-warn-50 p-4">
          <h2 className="text-lg font-bold">要手動対応（{pending.length}個）</h2>
          <p className="my-2 text-sm">対応先を選ぶか、ファイル名から単語を追加してください。残ったファイルは登録されません。</p>
          <Button onClick={() => { try { const result = matchFiles(wordsFromFiles(rows, pending.map(p => p.file)), pending.map(p => p.file)); setRows(result.rows); setPending(result.pending) } catch (e) { setError((e as Error).message) } }}>ファイル名から単語を追加して対応づける</Button>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">{pending.map(p => <PendingItem key={p.id} item={p} rows={rows} onAssign={(rowId, slot) => assign(p, rowId, slot)} onRemove={() => setPending(prev => prev.filter(item => item.id !== p.id))} />)}</ul>
        </section>}
        <section>
          <h2 className="mb-2 text-lg font-bold">登録前の確認：既存{initialCards.length}枚 ＋ 新規{newRows.length}枚</h2>
          <p className="mb-3 text-sm">単語の重複は警告です。画像・音声なしでも登録できます。登録しない行はチェックを外してください。</p>
          <div className="overflow-x-auto rounded-xl border-2 border-line"><table className="w-full min-w-[740px] text-sm">
            <thead className="bg-brand-50"><tr><th className="p-2">登録</th><th>単語</th>{SLOTS.map(s => <th key={s}>{SLOT_LABELS[s]}</th>)}<th>確認</th></tr></thead>
            <tbody>{rows.map((row, i) => <tr key={row.id} className="border-t border-line align-top">
              <td className="p-2"><input type="checkbox" aria-label={`${i + 1}行目を登録`} checked={row.selected} onChange={e => update(row.id, { selected: e.target.checked })} className="h-6 w-6" /><div className="mt-2">{row.existing ? '既存' : '新規'}</div></td>
              <td className="min-w-44 p-2"><input aria-label={`${i + 1}行目の単語`} readOnly={!!row.existing} className={field} value={row.word} onChange={e => update(row.id, { word: e.target.value })} />{!row.existing && <Button className="mt-2" onClick={() => { setRows(prev => prev.filter(r => r.id !== row.id)); setPending(prev => [...prev, ...Object.values(row.files).map(file => ({ id: crypto.randomUUID(), file, reason: '行から外したファイルです' }))]) }}>行を外す</Button>}</td>
              {SLOTS.map(slot => <td key={slot} className="max-w-48 p-2 break-all">{row.files[slot] ? <><LocalPreview file={row.files[slot]!} /><p>{row.files[slot]!.name}</p><Button onClick={() => { const file = row.files[slot]!; const files = { ...row.files }; delete files[slot]; update(row.id, { files }); setPending(prev => [...prev, { id: crypto.randomUUID(), file, reason: '対応を外しました' }]) }}>対応を外す</Button></> : row.existing && slotPath(row.existing, slot) ? '登録済み' : row.expected[slot] ? <span className="text-warn-700">未選択：{row.expected[slot]}</span> : '—'}</td>)}
              <td className="min-w-40 p-2">{rowError(row) && <p className="font-bold text-danger-700">{rowError(row)}</p>}{row.word.trim() && rows.filter(r => normalizeWord(r.word) === normalizeWord(row.word)).length > 1 && <p className="text-warn-700">同じ単語があります</p>}{!row.files.image && !(row.existing?.image_path) && <p>画像なし</p>}{row.existing && SLOTS.some(s => row.files[s] && slotPath(row.existing!, s)) && <p className="text-warn-700">登録済みファイルを変更します</p>}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </fieldset>
      {!busy && note && <p role="status" className="rounded-xl bg-brand-50 p-4 font-bold">{note}</p>}
      {!job && <ActionError error={error} onRetry={retry} onDismiss={() => setError('')} busy={busy} />}
      {!complete && <div className="rounded-xl border-2 border-line bg-surface p-4">
        <p className="mb-3">登録対象：{selected.length}枚{replacements > 0 ? `（既存ファイル${replacements}個を変更）` : ''}。未対応{pending.length}個は登録しません。</p>
        {errors.length > 0 && <p className="mb-2 font-bold text-danger-700">{errors.length}行にエラーがあります。修正するかチェックを外してください。</p>}
        {selected.filter(r => !r.existing).length + initialCards.length > 120 && <p className="mb-2 text-warn-700">120枚を超えると読み込みに時間がかかることがあります。</p>}
        <Button variant="primary" size="lg" disabled={busy || (!job && (!selected.length || !!errors.length))} onClick={() => void save()}>{busy ? '登録中…' : job ? '続きから再試行' : '確認した内容を登録'}</Button>
        {job && <ActionError error={error} onRetry={() => void save()} onDismiss={() => setError('')} busy={busy} />}
      </div>}
      {(!busy && (complete || !dirty)) && <Link className="min-h-11 p-3 font-bold underline" to={`/t/sets/${setId}/edit`}>編集画面へ戻る</Link>}
      {job && !busy && !complete && <Link className="min-h-11 p-3 underline" to={`/t/sets/${setId}/edit`}>登録済みの分を編集画面で確認する（未完了分の再開はこの画面で）</Link>}
      {dirty && !job && <Button onClick={() => { if (window.confirm('未登録の内容を破棄して編集画面に戻りますか？')) { setRows(existingRows(initialCards)); setPending([]); setPaste(''); setError(''); setNote('入力を取り消しました。') } }}>未登録の内容を取り消す</Button>}
    </main>
  </>
}
function PendingItem({ item, rows, onAssign, onRemove }: { item: PendingFile; rows: DraftRow[]; onAssign: (rowId: string, slot: Slot) => void; onRemove: () => void }) {
  const kind = fileSlot(item.file)
  const [slot, setSlot] = useState<Slot>(kind)
  const [rowId, setRowId] = useState('')
  const invalid = checkUploadFile(item.file, kind)
  return <li className="flex flex-col gap-2 rounded-xl bg-surface p-3">
    {!invalid && <LocalPreview file={item.file} />}<strong className="break-all">{item.file.name}</strong><p className="text-sm">{item.reason}</p>
    {!invalid && <><label>種類<select className={field} aria-label={`${item.file.name}の種類`} value={slot} onChange={e => setSlot(e.target.value as Slot)}>{(kind === 'audio' ? ['audio'] as const : ['image', 'pairImage'] as const).map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}</select></label>
      <label>対応する単語<select className={field} aria-label={`${item.file.name}の対応先`} value={rowId} onChange={e => setRowId(e.target.value)}><option value="">選択してください</option>{rows.map((r, i) => <option key={r.id} value={r.id}>{i + 1}. {r.word || '（単語なし）'}</option>)}</select></label><Button disabled={!rowId} onClick={() => onAssign(rowId, slot)}>この単語に対応づける</Button></>}
    <Button variant="ghost" onClick={onRemove}>このファイルを外す</Button>
  </li>
}
