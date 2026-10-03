import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fontText, teacherFontText } from './font-text.mjs'
import { renameEnglishFont } from './font-names.mjs'
import subsetFont from 'subset-font'

// Build-time downloads only. The application serves the resulting WOFF2 locally.
const root = process.cwd()
const revision = '84efd8ad78c3710ad14bd909e3bc407151885628'
const output = path.join(root, 'public/fonts')
const { japanese, latin, files } = await fontText(root)
const { teacher, nativeSymbols, files: teacherFiles } = await teacherFontText(root)
const variants = [
  ['mplusrounded1c', 'MPLUSRounded1c-Bold.ttf', 'rounded-700.woff2', japanese],
  ['andika', 'Andika-Bold.ttf', 'wordcards-latin-bold.woff2', latin],
  ['mplusrounded1c', 'MPLUSRounded1c-Bold.ttf', 'rounded-700-teacher.woff2', teacher],
]
await mkdir(output, { recursive: true })
const manifest = { sources: [], glyphCount: japanese.length, inputFiles: files, teacherInputFiles: teacherFiles, teacherFamily: 'WordCards Rounded Teacher', nativeSymbolFallback: nativeSymbols, characters: { japanese, latin, teacher }, englishFamily: 'WordCards Latin', studentRoundedSha256: '997863e680a743d918efd8f222acad528de4b2a864e92bfb8e1eba2c69309d1a', fonts: [] }
for (const [family, filename, target, characters] of variants) {
  const url = `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/${family}/${filename}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Font download failed: ${response.status} ${filename}`)
  const original = Buffer.from(await response.arrayBuffer())
  const font = await subsetFont(family === 'andika' ? renameEnglishFont(original) : original, characters, { targetFormat: 'woff2', preserveNameIds: [0, 13, 14] })
  if (target === 'rounded-700.woff2' && createHash('sha256').update(font).digest('hex') !== manifest.studentRoundedSha256) throw new Error('Student Rounded subset changed')
  await writeFile(path.join(output, target), font)
  manifest.sources.push({ url, sha256: createHash('sha256').update(original).digest('hex') })
  manifest.fonts.push({ file: target, bytes: font.length, sha256: createHash('sha256').update(font).digest('hex'), source: url, family: target === 'rounded-700-teacher.woff2' ? manifest.teacherFamily : family === 'andika' ? 'WordCards Latin' : 'WordCards Rounded', license: family === 'andika' ? 'andika-OFL.txt' : 'mplusrounded1c-OFL.txt' })
}
// Rounded's Google Fonts directory omits OFL.txt. Its binary name table specifies
// SIL OFL 1.1 and the copyright below. Include the identical standard license text
// from Andika, with Rounded's own copyright (never Andika's reserved-name header).
const response = await fetch(`https://raw.githubusercontent.com/google/fonts/${revision}/ofl/andika/OFL.txt`)
if (!response.ok) throw new Error('License download failed')
const license = await response.text()
await writeFile(path.join(output, 'andika-OFL.txt'), license)
await writeFile(path.join(output, 'mplusrounded1c-OFL.txt'), 'Copyright 2016 The Rounded M+ Project Authors.\n\n'
  + license.slice(license.indexOf('This Font Software')))
await writeFile(path.join(output, 'subset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ glyphCount: manifest.glyphCount, fonts: manifest.fonts, total: manifest.fonts.reduce((sum, font) => sum + font.bytes, 0) }, null, 2))
