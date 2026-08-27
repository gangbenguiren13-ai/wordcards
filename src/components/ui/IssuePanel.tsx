import type { Issue } from '@/lib/validation'

/**
 * バリデーション結果の警告パネル。
 * エラー（保存不可）と警告（保存可）を明確に分けて表示する。
 * 色だけに頼らず、記号と見出し文字を併用する。
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
            ⚠ なおすまで保存できません（{errors.length}件）
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
            ！ 確認してください（{warnings.length}件・保存はできます）
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
