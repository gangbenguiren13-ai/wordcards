import { Link } from 'react-router-dom'

interface Props {
  title: string
  phase: string
  /**
   * 生徒用ルート（/p/:token）では false にすること。
   * 生徒画面から管理画面へ移動できる導線を一切置かないため（計画書 8 / 14）。
   */
  showTeacherLink?: boolean
}

/**
 * まだ実装していないフェーズの画面。
 * ルーティングと画面遷移を先に確定させるために置いてある。
 */
export function ComingSoon({ title, phase, showTeacherLink = true }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        🚧
      </p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-ink-soft">
        この画面は開発計画書の <strong>{phase}</strong> で作ります。
      </p>
      {showTeacherLink && (
        <Link to="/t/home" className="font-bold text-brand-600 underline">
          ホームにもどる
        </Link>
      )}
    </main>
  )
}
