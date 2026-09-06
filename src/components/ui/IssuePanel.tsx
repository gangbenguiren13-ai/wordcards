import type { Issue } from '@/lib/validation'

/**
 * バリデーション結果の警告パネル。
 *
 * エラーは「保存できない」ではなく「共有とゲーム開始ができない」を意味する。
 * 編集は自動保存で進むので、途中の未完成な状態も保存できないと作業が続かない。
 * 止めるべきなのは、その未完成なものを生徒に配ったり授業で出したりする瞬間。
 */
export function IssuePanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <div className="flex flex-col gap-3">
      {errors.length > 0 && (
        <section className="rounded-xl border-2 border-danger-500 bg-danger-50 p-4">
          <h3 className="font-bold text-danger-700">
            ⚠ なおすまで 共有・ゲーム開始 ができません（{errors.length}件）
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {errors.map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="rounded-xl border-2 border-warn-500 bg-warn-50 p-4">
          <h3 className="font-bold text-warn-700">
            ！ 確認してください（{warnings.length}件・このままでも進められます）
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
