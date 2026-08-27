import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/auth/RequireAuth'
import { ComingSoon } from '@/pages/ComingSoon'
import { NotFound } from '@/pages/NotFound'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Spinner } from '@/components/ui'

/*
 * 教師用画面は遅延読み込みにする。
 * 生徒（/p/:token）が管理画面のコードまでダウンロードしないようにして、
 * 校内Wi-Fiが細い環境での初回表示を軽くする（計画書 15）。
 */
const LoginPage = lazy(() =>
  import('@/pages/teacher/Login').then((m) => ({ default: m.LoginPage })),
)
const HomePage = lazy(() =>
  import('@/pages/teacher/Home').then((m) => ({ default: m.HomePage })),
)
const SetEditPage = lazy(() =>
  import('@/pages/teacher/SetEdit').then((m) => ({ default: m.SetEditPage })),
)

export function App() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/t/home" replace />} />

          {/* ---------- 教師用（ログイン必須） ---------- */}
          <Route path="/t/login" element={<LoginPage />} />
          <Route
            path="/t/home"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/t/sets/:id/edit"
            element={
              <RequireAuth>
                <SetEditPage />
              </RequireAuth>
            }
          />
          <Route
            path="/t/sets/:id/import"
            element={
              <RequireAuth>
                <ComingSoon title="一括登録" phase="P2" />
              </RequireAuth>
            }
          />
          <Route
            path="/t/sets/:id/preview"
            element={
              <RequireAuth>
                <ComingSoon title="プレビュー" phase="P6" />
              </RequireAuth>
            }
          />
          <Route
            path="/t/sets/:id/play"
            element={
              <RequireAuth>
                <ComingSoon title="ゲーム選択" phase="P4" />
              </RequireAuth>
            }
          />

          {/* ---------- 生徒用（ログインなし・管理画面への導線を置かない） ---------- */}
          <Route
            path="/p/:token"
            element={<ComingSoon title="生徒用の参加ページ" phase="P3" showTeacherLink={false} />}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
