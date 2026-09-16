import { createContext } from 'react'

export type ToastKind = 'error' | 'success' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  saved?: boolean
  setGameRole?: (role: 'teacher' | 'student' | null) => void
}

export const ToastContext = createContext<ToastApi>({ show: () => {} })
