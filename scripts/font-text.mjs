import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
export async function fontText(root = process.cwd()) {
const files = new Set()
async function visit(file) {
  if (files.has(file)) return
  files.add(file)
  const source = await readFile(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const imports = ast.statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier.text)
  for (const specifier of imports) {
    const base = /^@\/(components|games)\//.test(specifier) ? path.join(root, 'src', specifier.slice(2))
      : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null
    if (!base || !/[/\\](components|games|student)[/\\]/.test(base)) continue
    for (const suffix of ['.tsx', '.ts', '/index.ts', '/index.tsx']) {
      const candidate = base + suffix
      try { await readFile(candidate); await visit(candidate); break } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  }
}
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) await walk(file)
    else if (/\.tsx?$/.test(file) && !/\.test\./.test(file)) await visit(file)
  }
}
await walk(path.join(root, 'src/pages/student'))
let literals = ''
for (const file of files) {
  const ast = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true)
  function collect(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) literals += node.text
    ts.forEachChild(node, collect)
  }
  collect(ast)
}
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('')
const latin = range(0x20, 0x7e)
const japanese = [...new Set(latin + range(0x3041, 0x3096) + range(0x3099, 0x309f) + range(0x30a0, 0x30ff)
  + (literals.match(/[\p{Script=Han}\p{P}\p{S}]/gu)?.join('') ?? ''))].sort().join('')
return { japanese, latin, files: [...files].map(f => path.relative(root, f).replaceAll('\\', '/')).sort() }
}
