import { useContext } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
