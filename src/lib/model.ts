export interface Card { id: string; term: string; meaning: string; difficult: boolean }
interface Collection { id: string; title: string; color: string; favorite: boolean }
export interface Deck extends Collection { kind: 'deck'; cards: Card[] }
export interface Compilation extends Collection { kind: 'compilation'; deckIds: string[] }
export type Notebook = Deck | Compilation
export interface Settings {
  direction: 'term' | 'meaning'
  shuffle: boolean
  mode: 'manual' | 'auto'
  questionSeconds: number
  answerSeconds: number
}
export interface Library { version: 1; decks: Deck[]; compilations: Compilation[]; settings: Settings }
export interface StudyCard extends Card { deckId: string; deckTitle: string }
export const COLORS = ['#ff526f', '#ff9d43', '#f5da52', '#87f57b', '#45ddf5', '#749bff', '#c099ff']
export const DEFAULT_SETTINGS: Settings = { direction: 'term', shuffle: true, mode: 'manual', questionSeconds: 5, answerSeconds: 3 }
export const emptyLibrary = (): Library => ({ version: 1, decks: [], compilations: [], settings: { ...DEFAULT_SETTINGS } })
export const newId = () => crypto.randomUUID()

export function cardsFor(library: Library, notebook: Notebook): StudyCard[] {
  const decks = notebook.kind === 'deck' ? [notebook] : notebook.deckIds.flatMap(id => library.decks.filter(d => d.id === id))
  const seen = new Set<string>()
  return decks.flatMap(d => d.cards.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  }).map(c => ({ ...c, deckId: d.id, deckTitle: d.title })))
}

/** Remaining excludes the card being answered. The result is the number of intervening cards. */
export function retryDistance(remaining: number): number {
  return Math.min(remaining, Math.max(3, Math.ceil(remaining * 0.5)))
}

export function requeue<T>(queue: readonly T[]): T[] {
  if (queue.length === 0) return []
  const [current, ...rest] = queue
  rest.splice(retryDistance(rest.length), 0, current)
  return rest
}

export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function markDifficult(library: Library, cardId: string, difficult: boolean): Library {
  return { ...library, decks: library.decks.map(d => ({ ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, difficult } : c) })) }
}

export function characters(text: string): string[] {
  return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].map(s => s.segment)
}

/** Validate and rebuild external data before it can replace the current library. */
export function validateLibrary(input: unknown): Library {
  const fail = (): never => { throw new Error('バックアップの形式が正しくありません。現在のデータは変更していません。') }
  const obj = (x: unknown): Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : fail()
  const str = (x: unknown): string => typeof x === 'string' && x.trim().length > 0 ? x : fail()
  const bool = (x: unknown): boolean => typeof x === 'boolean' ? x : fail()
  const arr = (x: unknown): unknown[] => Array.isArray(x) ? x : fail()
  const ids = new Set<string>()
  const id = (x: unknown): string => { const v = str(x); if (ids.has(v)) fail(); ids.add(v); return v }
  const base = (x: Record<string, unknown>) => {
    const color = str(x.color)
    if (!/^#[\da-f]{6}$/i.test(color)) fail()
    return { id: id(x.id), title: str(x.title), color, favorite: bool(x.favorite) }
  }
  const root = obj(input)
  if (root.version !== 1) fail()
  const decks: Deck[] = arr(root.decks).map(value => {
    const d = obj(value)
    if (d.kind !== 'deck') fail()
    return { ...base(d), kind: 'deck', cards: arr(d.cards).map(value => {
      const c = obj(value)
      return { id: id(c.id), term: str(c.term), meaning: str(c.meaning), difficult: bool(c.difficult) }
    }) }
  })
  const deckIds = new Set(decks.map(d => d.id))
  const compilations: Compilation[] = arr(root.compilations).map(value => {
    const d = obj(value)
    if (d.kind !== 'compilation') fail()
    const references = arr(d.deckIds).map(str)
    if (new Set(references).size !== references.length || references.some(v => !deckIds.has(v))) fail()
    return { ...base(d), kind: 'compilation', deckIds: references }
  })
  const s = obj(root.settings)
  const seconds = (v: unknown): number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 60 ? v : fail()
  if ((s.direction !== 'term' && s.direction !== 'meaning') || (s.mode !== 'manual' && s.mode !== 'auto')) fail()
  return { version: 1, decks, compilations, settings: {
    direction: s.direction as Settings['direction'], mode: s.mode as Settings['mode'], shuffle: bool(s.shuffle),
    questionSeconds: seconds(s.questionSeconds), answerSeconds: seconds(s.answerSeconds),
  } }
}
