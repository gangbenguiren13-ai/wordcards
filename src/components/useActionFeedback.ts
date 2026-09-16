import { useState } from 'react'
import { useToast } from './toast/useToast'
import { toJapaneseError } from '@/lib/errorMessage'

export function useActionFeedback() {
  const toast = useToast()
  const [errors, setErrors] = useState<Record<string, { message: string; retry?: () => void }>>({})
  function clear(key: string) { setErrors(prev => { const next = { ...prev }; delete next[key]; return next }) }
  function fail(key: string, error: unknown, retry?: () => void) {
    const message = typeof error === 'string' ? error : toJapaneseError(error)
    setErrors(prev => ({ ...prev, [key]: { message, retry } }))
    toast.show(message, 'error')
  }
  async function run(key: string, action: () => Promise<unknown>) {
    try { await action(); clear(key); toast.show('保存しました', 'success') }
    catch (error) { fail(key, error, () => void run(key, action)) }
  }
  return { errors, clear, fail, run }
}
