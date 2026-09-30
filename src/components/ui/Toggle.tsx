interface Props {
  student?: boolean
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

/** 状態を色だけで示さず、ON/OFF の文字も併記する（計画書 11） */
export function Toggle({ label, description, checked, onChange, disabled, student = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center justify-between gap-4 rounded-xl border-2 p-3 text-left',
        'min-h-14 transition-colors disabled:opacity-40',
        checked ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
      ].join(' ')}
    >
      <span className="flex flex-col">
        <span className="font-bold">{label}</span>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </span>
      <span
        className={[
          'shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold',
          checked ? 'bg-brand-600 text-white' : 'bg-line text-ink-soft',
        ].join(' ')}
      >
        {student ? (checked ? 'あり' : 'なし') : (checked ? 'ON' : 'OFF')}
      </span>
    </button>
  )
}
