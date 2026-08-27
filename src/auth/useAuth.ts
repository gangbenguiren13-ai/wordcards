import { useContext } from 'react'
import { AuthContext, type AuthState } from './AuthProvider'

/** ログイン中のユーザーとサインアウト関数を取り出す */
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
