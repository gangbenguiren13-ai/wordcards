import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { toJapaneseError } from '@/lib/errorMessage'
import { App } from './App'
import './styles/index.css'

/**
 * サーバー操作の失敗は、ここで一括して受け止める。
 *
 * 画面ごとに個別のエラー表示を書いていくと必ず書き漏れが出て、
 * 「押しても何も起こらない」という一番原因の分かりにくい状態になる。
 * 入口を1つにしておけば、新しい操作を足しても自動的に表示される。
 */
let showToast: (message: string, kind?: 'error' | 'success' | 'info') => void = () => {}
export function registerToast(fn: typeof showToast) {
  showToast = fn
}

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => showToast(toJapaneseError(error), 'error'),
    onSuccess: () => showToast('保存しました', 'success'),
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider onReady={registerToast}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
