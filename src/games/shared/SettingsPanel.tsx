import type { ReactNode } from 'react'

/**
 * ゲーム開始前の設定画面の部品。
 * 授業前の限られた時間で迷わず設定できるよう、選択肢は必ず全部見える形にする
 * （プルダウンに隠さない）。タップ領域は指で押せる大きさを保つ。
 */

export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b-2 border-line py-4 last:border-b-0">
      <div>
        <span className="text-base font-bold">{label}</span>
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export interface ChoiceOption<T extends string | number> {
  value: T
  label: string
  sub?: string
}

export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: ChoiceOption<T>[]
  value: T
  onChange: (v: T) => void
  columns?: number
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            'min-h-14 rounded-xl border-2 px-3 py-2 font-bold',
            value === o.value
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-line bg-surface',
          ].join(' ')}
        >
          {o.label}
          {o.sub && <span className="block text-xs font-normal text-ink-soft">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="減らす"
        className="h-14 w-14 rounded-xl border-2 border-line text-2xl font-bold disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-20 text-center text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-ink-soft">{unit}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="増やす"
        className="h-14 w-14 rounded-xl border-2 border-line text-2xl font-bold disabled:opacity-30"
      >
        ＋
      </button>
    </div>
  )
}
