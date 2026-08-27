export function Spinner({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-ink-soft">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-brand-500"
        aria-hidden="true"
      />
      <p className="font-bold">{label}</p>
    </div>
  )
}
