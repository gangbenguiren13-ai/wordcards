import { supabase } from '@/lib/supabase'
import * as media from '@/lib/mediaStore'
import type { Card, GamesConfig, MaterialSet, SetMode } from '@/types'
import { defaultGamesConfig } from '@/lib/gameDefaults'

export interface SetListItem extends MaterialSet {
  card_count: number
}

/** 有効な（ゴミ箱にない）セット一覧 */
export async function listSets(): Promise<SetListItem[]> {
  const { data, error } = await supabase
    .from('material_sets')
    .select('*, cards(count)')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeListRow)
}

/** ゴミ箱の中身 */
export async function listTrash(): Promise<SetListItem[]> {
  const { data, error } = await supabase
    .from('material_sets')
    .select('*, cards(count)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeListRow)
}

function normalizeListRow(row: Record<string, unknown>): SetListItem {
  const cards = row.cards as { count: number }[] | undefined
  const { cards: _drop, ...rest } = row
  void _drop
  return {
    ...(rest as unknown as MaterialSet),
    card_count: cards?.[0]?.count ?? 0,
  }
}

export async function getSet(id: string): Promise<MaterialSet> {
  const { data, error } = await supabase
    .from('material_sets')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as MaterialSet
}

export async function getCards(setId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Card[]
}

export async function createSet(input: {
  title: string
  mode: SetMode
}): Promise<MaterialSet> {
  const { data: userData } = await supabase.auth.getUser()
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('ログインしていません')

  const { data, error } = await supabase
    .from('material_sets')
    .insert({
      owner_id: ownerId,
      title: input.title,
      mode: input.mode,
      default_display: input.mode === 'elementary' ? 'image_only' : 'word_image',
      games_config: defaultGamesConfig(input.mode) as unknown as GamesConfig,
    })
    .select()
    .single()
  if (error) throw error
  return data as MaterialSet
}

export async function updateSet(
  id: string,
  patch: Partial<
    Pick<
      MaterialSet,
      | 'title'
      | 'mode'
      | 'default_display'
      | 'audio_enabled'
      | 'show_word_on_answer'
      | 'games_config'
      | 'share_enabled'
    >
  >,
): Promise<void> {
  const { error } = await supabase.from('material_sets').update(patch).eq('id', id)
  if (error) throw error
}

/** ゴミ箱へ（30日後に purge-trash 関数が物理削除する） */
export async function softDeleteSet(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_sets')
    .update({ deleted_at: new Date().toISOString(), share_enabled: false })
    .eq('id', id)
  if (error) throw error
}

export async function restoreSet(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_sets')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw error
}

/** セットを複製する。メディアは参照共有せず物理コピーする。 */
export async function duplicateSet(id: string): Promise<MaterialSet> {
  const { data: userData } = await supabase.auth.getUser()
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('ログインしていません')

  const original = await getSet(id)
  const cards = await getCards(id)

  const { data: created, error } = await supabase
    .from('material_sets')
    .insert({
      owner_id: ownerId,
      title: `${original.title} のコピー`.slice(0, 60),
      mode: original.mode,
      default_display: original.default_display,
      audio_enabled: original.audio_enabled,
      show_word_on_answer: original.show_word_on_answer,
      games_config: original.games_config,
    })
    .select()
    .single()
  if (error) throw error
  const newSet = created as MaterialSet

  for (const card of cards) {
    const { data: newCard, error: cardError } = await supabase
      .from('cards')
      .insert({
        set_id: newSet.id,
        word: card.word,
        sort_order: card.sort_order,
      })
      .select()
      .single()
    if (cardError) throw cardError

    const patch: Partial<Card> = {}
    for (const kind of ['image', 'pair', 'audio'] as const) {
      const src =
        kind === 'image'
          ? card.image_path
          : kind === 'pair'
            ? card.pair_image_path
            : card.audio_path
      if (!src) continue
      const ext = src.split('.').pop() ?? 'webp'
      const dest = media.mediaPath(ownerId, newSet.id, newCard.id, kind, ext)
      await media.copyMedia(src, dest)
      if (kind === 'image') patch.image_path = dest
      if (kind === 'pair') patch.pair_image_path = dest
      if (kind === 'audio') patch.audio_path = dest
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('cards').update(patch).eq('id', newCard.id)
    }
  }

  return newSet
}

/** 共有トークンを発行・再発行する（生成はサーバー側 RPC が行う） */
export async function issueShareToken(setId: string): Promise<string> {
  const { data, error } = await supabase.rpc('issue_share_token', { p_set_id: setId })
  if (error) throw error
  return data as string
}
