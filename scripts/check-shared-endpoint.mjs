// Run the actual Deno handler with mocked Supabase I/O; never connects to a real project.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
let handle
let scenario
const token = 'abcdefghijklmnopqrstu'
const source = fs.readFileSync(new URL('../supabase/functions/shared-set/index.ts', import.meta.url), 'utf8')
  .replace(/^import .* from .*\r?\n/gm, '')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const admin = {
  rpc: async () => ({ data: scenario.limited ? false : true, error: scenario.rateError ? {} : null }),
  from(table) {
    const filters = {}
    const result = () => table === 'material_sets'
      ? { data: filters.share_token === token && filters.share_enabled === true && filters.deleted_at === null && !scenario.stopped ? {
        id: 's', owner_id: 'private-owner', title: '動物', mode: 'junior', default_display: 'word_only', games_config: {},
      } : null, error: scenario.setError ? {} : null }
      : { data: [{ id: 'c', word: 'cat', image_path: 'private/image', audio_path: null, pair_image_path: null, sort_order: 0 }], error: scenario.cardsError ? {} : null }
    const query = {
      select: () => query, eq: (key, value) => { filters[key] = value; return query },
      is: (key, value) => { filters[key] = value; return query },
      maybeSingle: async () => result(), order: async () => result(),
    }
    return query
  },
  storage: { from: () => ({ createSignedUrls: async () => ({
    data: scenario.missingMedia ? [] : [{ path: 'private/image', signedUrl: 'https://example.test/signed' }],
    error: scenario.signError ? {} : null,
  }) }) },
}
vm.runInNewContext(compiled, {
  Deno: { env: { get: () => 'test-only' }, serve: (fn) => { handle = fn } },
  createClient: () => admin, clientIp: () => 'test-ip', corsHeaders: {},
  baseJson: (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  URL, Request, Response, Set,
})
for (const [name, state, path, method, status] of [
  ['valid', {}, token, 'GET', 200], ['invalid', {}, 'bad', 'GET', 404],
  ['old token', {}, 'uvwxyzabcdefghijklmno', 'GET', 404], ['stopped/deleted', { stopped: true }, token, 'GET', 404],
  ['rate limited', { limited: true }, token, 'GET', 429], ['rate storage failure', { rateError: true }, token, 'GET', 503],
  ['set failure', { setError: true }, token, 'GET', 503], ['card failure', { cardsError: true }, token, 'GET', 503],
  ['signing failure', { signError: true }, token, 'GET', 503], ['missing media', { missingMedia: true }, token, 'GET', 503],
  ['method', {}, token, 'POST', 405],
]) {
  scenario = state
  const response = await handle(new Request(`https://example.test/shared-set?token=${path}`, { method }))
  assert.equal(response.status, status, name)
  assert.equal(response.headers.get('Cache-Control'), 'no-store', name)
  if (status === 200) {
    const body = await response.json()
    assert.equal(body.cards[0].imageUrl, 'https://example.test/signed')
    assert.equal(JSON.stringify(body).includes('private-owner'), false)
    assert.equal(JSON.stringify(body).includes('private/image'), false)
  }
}
console.log('Shared endpoint: 11 scenarios passed (mocked I/O).')
