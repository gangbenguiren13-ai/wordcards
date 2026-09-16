import type { SetListItem } from '@/api/sets'

interface Recent { id: string; usedAt: number }
const key = (owner: string) => `wordcards.recent.${owner}`
function read(owner: string): Recent[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key(owner)) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.filter((r): r is Recent => r && typeof r.id === 'string' && typeof r.usedAt === 'number' && Number.isFinite(r.usedAt))
  } catch { return [] }
}
/** 実際に先読みが完了した教師のゲームだけを記録。教材内容・得点は保存しない。 */
export function rememberUsed(owner: string, id: string, now = Date.now()) {
  if (!owner || !id) return
  try { localStorage.setItem(key(owner), JSON.stringify([{ id, usedAt: now }, ...read(owner).filter(r => r.id !== id)].slice(0, 50))) } catch { /* optional convenience */ }
}
export function recentSets(sets: SetListItem[]): SetListItem[] {
  const recent = [...new Set(sets.map(s => s.owner_id))].flatMap(read).sort((a, b) => b.usedAt - a.usedAt)
  return [...new Set(recent.map(r => r.id))].flatMap(id => {
    const set = sets.find(s => s.id === id && !s.deleted_at)
    return set ? [set] : []
  }).slice(0, 3)
}
export function matchesTitle(title: string, search: string): boolean {
  const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase('ja').trim().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  return normalize(title).includes(normalize(search))
}
