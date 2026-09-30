// Lossless SFNT table rebuild: rename only naming records, retaining outlines,
// hinting, copyright and license records. Recompute all SFNT checksums.
export function nameRecords(font) {
  const count = font.readUInt16BE(4)
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16
    if (font.toString('ascii', entry, entry + 4) !== 'name') continue
    const offset = font.readUInt32BE(entry + 8)
    const format = font.readUInt16BE(offset)
    if (format !== 0) throw new Error(`Unsupported name table format ${format}`)
    const start = font.readUInt16BE(offset + 4)
    return Array.from({ length: font.readUInt16BE(offset + 2) }, (_, n) => {
      const record = offset + 6 + 12 * n
      const platform = font.readUInt16BE(record)
      const bytes = font.subarray(offset + start + font.readUInt16BE(record + 10), offset + start + font.readUInt16BE(record + 10) + font.readUInt16BE(record + 8))
      return { header: Buffer.from(font.subarray(record, record + 8)), id: font.readUInt16BE(record + 6),
        bytes, text: platform === 0 || platform === 3 ? Buffer.from(bytes).swap16().toString('utf16le') : bytes.toString('latin1'), platform }
    })
  }
  throw new Error('No name table')
}
function checksum(buffer) {
  const data = Buffer.alloc(Math.ceil(buffer.length / 4) * 4)
  buffer.copy(data)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum = (sum + data.readUInt32BE(i)) >>> 0
  return sum
}
export function renameEnglishFont(font) {
  const replacements = new Map([[1, 'WordCards Latin'], [2, 'Bold'], [3, 'WordCardsLatin-Bold-20260929'],
    [4, 'WordCards Latin Bold'], [6, 'WordCardsLatin-Bold'], [16, 'WordCards Latin'], [17, 'Bold'],
    [18, 'WordCards Latin Bold'], [20, 'WordCardsLatin-Bold'], [21, 'WordCards Latin'], [22, 'Bold'], [25, 'WordCardsLatin']])
  const records = nameRecords(font)
  let length = 0
  const entries = records.map(record => {
    const value = replacements.get(record.id)
    const bytes = value === undefined ? record.bytes : record.platform === 0 || record.platform === 3
      ? Buffer.from(value, 'utf16le').swap16() : Buffer.from(value, 'ascii')
    const header = Buffer.alloc(12)
    record.header.copy(header); header.writeUInt16BE(bytes.length, 8); header.writeUInt16BE(length, 10)
    length += bytes.length
    return { header, bytes }
  })
  const header = Buffer.alloc(6)
  header.writeUInt16BE(records.length, 2); header.writeUInt16BE(6 + records.length * 12, 4)
  const name = Buffer.concat([header, ...entries.map(e => e.header), ...entries.map(e => e.bytes)])
  const count = font.readUInt16BE(4)
  const tableHeader = Buffer.from(font.subarray(0, 12 + count * 16))
  let offset = tableHeader.length
  let headOffset = 0
  const buffers = [tableHeader]
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16
    const tag = font.toString('ascii', entry, entry + 4)
    const start = font.readUInt32BE(entry + 8)
    const data = tag === 'name' ? name : Buffer.from(font.subarray(start, start + font.readUInt32BE(entry + 12)))
    if (tag === 'head') { data.writeUInt32BE(0, 8); headOffset = offset }
    tableHeader.writeUInt32BE(checksum(data), entry + 4)
    tableHeader.writeUInt32BE(offset, entry + 8); tableHeader.writeUInt32BE(data.length, entry + 12)
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4); data.copy(padded)
    buffers.push(padded); offset += padded.length
  }
  const result = Buffer.concat(buffers)
  if (!headOffset) throw new Error('No head table')
  result.writeUInt32BE((0xb1b0afba - checksum(result)) >>> 0, headOffset + 8)
  for (const record of nameRecords(result)) if (replacements.has(record.id) && /Andika|SIL/i.test(record.text)) throw new Error('Reserved name remains')
  return result
}
