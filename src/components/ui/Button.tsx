import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'md' | 'lg' | 'xl'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 active:bg-brand-700',
  secondary:
    'bg-surface text-ink border-line hover:bg-brand-50 active:bg-brand-100',
  danger:
    'bg-surface text-danger-700 border-danger-500 hover:bg-danger-50 active:bg-danger-50',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-black/5',
}

// 最小タップ領域 44px、生徒用の主要操作は 64px 以上（計画書 7）
const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-base gap-2',
  lg: 'min-h-14 px-6 text-lg gap-2.5',
  xl: 'min-h-16 px-8 text-xl gap-3',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      data-variant={variant}
      className={[
        'inline-flex items-center justify-center rounded-xl border-2 font-bold',
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
