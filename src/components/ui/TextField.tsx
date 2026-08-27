import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, id, className = '', ...rest }: Props) {
  const inputId = id ?? `f-${label}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-ink-soft">
        {label}
      </label>
      <input
        id={inputId}
        className={[
          'min-h-11 rounded-xl border-2 bg-surface px-3.5 text-base',
          error ? 'border-danger-500' : 'border-line focus:border-brand-500',
          className,
        ].join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-err`} className="text-sm font-bold text-danger-700">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}
