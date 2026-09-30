import { readFile, readdir } from 'node:fs/promises'
import { create } from 'fontkit'
import { fontText } from './font-text.mjs'
const { japanese, latin } = await fontText()
const rounded = create(await readFile('public/fonts/rounded-700.woff2'))
const english = create(await readFile('public/fonts/wordcards-latin-bold.woff2'))
const missing = [...japanese].filter(c => !rounded.hasGlyphForCodePoint(c.codePointAt(0)))
if (missing.length) throw new Error(`Japanese font missing: ${[...new Set(missing)].join('')}`)
if ([...latin].some(c => !english.hasGlyphForCodePoint(c.codePointAt(0)))) throw new Error('English character missing')
if (/Andika|SIL/i.test([english.familyName, english.subfamilyName, english.fullName, english.postscriptName].join(' '))) throw new Error('Reserved font name remains')
const files = (await readdir('public/fonts')).filter(f => f.endsWith('.woff2'))
const sizes = await Promise.all(files.map(async f => (await readFile(`public/fonts/${f}`)).length))
if (sizes.reduce((a, b) => a + b, 0) > 300000) throw new Error('Font total exceeds 300 KB')
if ((await readFile('public/fonts/rounded-700.woff2')).length > 50000) throw new Error('Rounded exceeds 50 KB')
console.log(`Font coverage OK: ${japanese.length} Japanese/symbol characters; family=${english.familyName}; total=${sizes.reduce((a, b) => a + b, 0)} bytes`)
