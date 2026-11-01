export interface ImportedCard { term: string; meaning: string }

/** Two-column TSV, including CSV-style quoted cells and AI code fences. */
export function parseTsv(input: string): ImportedCard[] {
  let text = input.replace(/^\uFEFF/, '').trim()
  const fence = text.match(/^```(?:tsv|text)?\s*\n([\s\S]*?)\n```$/i)
  if (fence) text = fence[1]
  if (!text.trim()) return []
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, startLine = 1
  const error = (message: string): never => { throw new Error(`${line}行目: ${message}`) }
  const pushField = () => { cells.push(field); field = ''; closed = false }
  const pushRow = () => { pushField(); rows.push({ cells, line: startLine }); cells = []; startLine = line + 1 }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closed = true }
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++
        field += '\n'; line++
      } else { field += ch; if (ch === '\n') line++ }
    } else if (ch === '\t') pushField()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      pushRow(); line++
    } else if (ch === '"' && field === '' && !closed) quoted = true
    else {
      if (closed) error('引用符の後にはタブか改行が必要です。')
      field += ch
    }
  }
  if (quoted) error('引用符が閉じられていません。')
  pushRow()
  return rows.filter(row => !(row.cells.length === 1 && !row.cells[0].trim())).map(row => {
    if (row.cells.length !== 2) throw new Error(`${row.line}行目: 単語と意味の2列をタブで区切ってください。`)
    const [term, meaning] = row.cells.map(s => s.trim())
    if (!term || !meaning) throw new Error(`${row.line}行目: 単語と意味は両方必要です。`)
    return { term, meaning }
  })
}

export function exportTsv(cards: readonly ImportedCard[]): string {
  const quote = (s: string) => /[\t\r\n"]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  return cards.map(c => `${quote(c.term)}\t${quote(c.meaning)}`).join('\n')
}
