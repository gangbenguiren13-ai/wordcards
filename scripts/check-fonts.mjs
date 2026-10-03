import { readFile, readdir } from 'node:fs/promises'
import { create } from 'fontkit'
import { createHash } from 'node:crypto'
import { fontText, teacherFontText } from './font-text.mjs'
const { japanese, latin } = await fontText()
const rounded = create(await readFile('public/fonts/rounded-700.woff2'))
const english = create(await readFile('public/fonts/wordcards-latin-bold.woff2'))
const { teacher } = await teacherFontText()
const teacherFont = create(await readFile('public/fonts/rounded-700-teacher.woff2'))
if ([...teacher].some(c => !teacherFont.hasGlyphForCodePoint(c.codePointAt(0)))) throw new Error('Teacher character missing')
if (createHash('sha256').update(await readFile('public/fonts/rounded-700.woff2')).digest('hex') !== '997863e680a743d918efd8f222acad528de4b2a864e92bfb8e1eba2c69309d1a') throw new Error('Student Rounded changed')
const missing = [...japanese].filter(c => !rounded.hasGlyphForCodePoint(c.codePointAt(0)))
if (missing.length) throw new Error(`Japanese font missing: ${[...new Set(missing)].join('')}`)
if ([...latin].some(c => !english.hasGlyphForCodePoint(c.codePointAt(0)))) throw new Error('English character missing')
if (/Andika|SIL/i.test([english.familyName, english.subfamilyName, english.fullName, english.postscriptName].join(' '))) throw new Error('Reserved font name remains')
const files = (await readdir('public/fonts')).filter(f => f.endsWith('.woff2'))
const sizes = await Promise.all(files.map(async f => (await readFile(`public/fonts/${f}`)).length))
if (sizes.reduce((a, b) => a + b, 0) > 300000) throw new Error('Font total exceeds 300 KB')
if ((await readFile('public/fonts/rounded-700.woff2')).length > 50000) throw new Error('Rounded exceeds 50 KB')
console.log(`Font coverage OK: ${japanese.length} student and ${teacher.length} additional teacher characters; family=${english.familyName}; total=${sizes.reduce((a, b) => a + b, 0)} bytes`)
