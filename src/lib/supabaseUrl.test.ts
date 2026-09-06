import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from './supabaseUrl'

describe('normalizeSupabaseUrl', () => {
  it('正しいProject URLはそのまま', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co')
  })

  it('末尾のスラッシュを落とす', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co')
  })

  it('RESTエンドポイントを貼っても復元する（よくある事故）', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co')
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1')).toBe('https://abc.supabase.co')
  })

  it('auth/storage/functions のエンドポイントも復元する', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/auth/v1')).toBe('https://abc.supabase.co')
    expect(normalizeSupabaseUrl('https://abc.supabase.co/storage/v1/')).toBe('https://abc.supabase.co')
    expect(normalizeSupabaseUrl('https://abc.supabase.co/functions/v1')).toBe('https://abc.supabase.co')
  })

  it('前後の空白を落とす', () => {
    expect(normalizeSupabaseUrl('  https://abc.supabase.co  ')).toBe('https://abc.supabase.co')
  })

  it('未設定なら空文字', () => {
    expect(normalizeSupabaseUrl(undefined)).toBe('')
  })
})
