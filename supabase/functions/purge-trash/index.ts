// ゴミ箱に30日以上入っているセットを、メディアごと物理削除する。
// Supabase の Scheduled Functions（cron）から日次で呼ぶ。
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const RETENTION_DAYS = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (!cronSecret || provided !== cronSecret) {
    return json({ error: 'FORBIDDEN' }, 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString()
  const { data: sets } = await admin
    .from('material_sets')
    .select('id, owner_id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)

  let removedSets = 0
  let removedFiles = 0

  for (const set of sets ?? []) {
    const prefix = `${set.owner_id}/${set.id}`
    const { data: cardDirs } = await admin.storage.from('media').list(prefix, { limit: 1000 })
    const paths: string[] = []
    for (const dir of cardDirs ?? []) {
      const { data: files } = await admin.storage
        .from('media')
        .list(`${prefix}/${dir.name}`, { limit: 100 })
      for (const f of files ?? []) paths.push(`${prefix}/${dir.name}/${f.name}`)
    }
    if (paths.length > 0) {
      await admin.storage.from('media').remove(paths)
      removedFiles += paths.length
    }
    // cards は ON DELETE CASCADE で消える
    await admin.from('material_sets').delete().eq('id', set.id)
    removedSets++
  }

  return json({ ok: true, removedSets, removedFiles })
})
