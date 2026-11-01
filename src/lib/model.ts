// データモデルは PR #1（Library v1）と互換。JSON バックアップをそのまま相互に復元できる。

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
  /** 自動送りで最後まで行ったら最初に戻る（v1 に後から追加。無い場合は false） */
  loop: boolean
}

export interface Library { version: 1; decks: Deck[]; compilations: Compilation[]; settings: Settings }
export interface StudyCard extends Card { deckId: string; deckTitle: string; deckColor: string }

/** 虹の順: 赤 → 橙 → 黄 → 緑 → 水色 → 青 → 紫 */
export const COLORS = ['#ff5470', '#ff9d43', '#f5da52', '#87f57b', '#45ddf5', '#749bff', '#c099ff']
export const DEFAULT_SETTINGS: Settings = { direction: 'term', shuffle: true, mode: 'manual', questionSeconds: 5, answerSeconds: 3, loop: false }
export const emptyLibrary = (): Library => ({ version: 1, decks: [], compilations: [], settings: { ...DEFAULT_SETTINGS } })

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 1 card / 2 cards */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const allNotebooks = (library: Library): Notebook[] => [...library.decks, ...library.compilations]
export const findNotebook = (library: Library, id: string): Notebook | undefined => allNotebooks(library).find(n => n.id === id)

export function cardsFor(library: Library, notebook: Notebook): StudyCard[] {
  const decks = notebook.kind === 'deck' ? [notebook] : notebook.deckIds.flatMap(id => library.decks.filter(d => d.id === id))
  const seen = new Set<string>()
  return decks.flatMap(d => d.cards.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  }).map(c => ({ ...c, deckId: d.id, deckTitle: d.title, deckColor: d.color })))
}

/** 全単語帳の苦手カード（重複なし） */
export function weakCards(library: Library): StudyCard[] {
  return library.decks.flatMap(d => d.cards.filter(c => c.difficult).map(c => ({ ...c, deckId: d.id, deckTitle: d.title, deckColor: d.color })))
}

export function countCards(library: Library): { cards: number; weak: number } {
  let cards = 0, weak = 0
  for (const d of library.decks) for (const c of d.cards) { cards++; if (c.difficult) weak++ }
  return { cards, weak }
}

/** 再出題までに挟む枚数。remaining は今答えたカードを除く待機中の枚数。 */
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
  return updateCard(library, cardId, { difficult })
}

export function updateCard(library: Library, cardId: string, patch: Partial<Omit<Card, 'id'>>): Library {
  return { ...library, decks: library.decks.map(d => d.cards.some(c => c.id === cardId) ? { ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, ...patch } : c) } : d) }
}

export function deleteCard(library: Library, cardId: string): Library {
  return { ...library, decks: library.decks.map(d => d.cards.some(c => c.id === cardId) ? { ...d, cards: d.cards.filter(c => c.id !== cardId) } : d) }
}

export function addCards(library: Library, deckId: string, cards: { term: string; meaning: string }[]): Library {
  return { ...library, decks: library.decks.map(d => d.id === deckId ? { ...d, cards: [...d.cards, ...cards.map(c => ({ id: newId(), term: c.term, meaning: c.meaning, difficult: false }))] } : d) }
}

export function saveNotebook(library: Library, notebook: Notebook): Library {
  if (notebook.kind === 'deck') {
    const exists = library.decks.some(d => d.id === notebook.id)
    return { ...library, decks: exists ? library.decks.map(d => d.id === notebook.id ? { ...notebook, cards: d.cards } : d) : [...library.decks, notebook] }
  }
  const exists = library.compilations.some(c => c.id === notebook.id)
  return { ...library, compilations: exists ? library.compilations.map(c => c.id === notebook.id ? notebook : c) : [...library.compilations, notebook] }
}

export function deleteNotebook(library: Library, id: string): Library {
  return {
    ...library,
    decks: library.decks.filter(d => d.id !== id),
    compilations: library.compilations.filter(c => c.id !== id).map(c => c.deckIds.includes(id) ? { ...c, deckIds: c.deckIds.filter(x => x !== id) } : c),
  }
}

export function toggleFavorite(library: Library, id: string): Library {
  return {
    ...library,
    decks: library.decks.map(d => d.id === id ? { ...d, favorite: !d.favorite } : d),
    compilations: library.compilations.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c),
  }
}

/** 書記素（見た目の1文字）単位で分割する。結合文字・絵文字を途中で切らない。 */
export function characters(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].map(s => s.segment)
  return Array.from(text)
}

/** 答えを左から n 文字だけ見せる。空白・改行はそのまま。 */
export function hintText(answer: string, shown: number): { text: string; total: number } {
  let count = 0
  const segments = characters(answer)
  const total = segments.filter(c => !/\s/u.test(c)).length
  const text = segments.map(c => /\s/u.test(c) ? c : ++count <= shown ? c : '_').join('')
  return { text, total }
}

/** 外部データを検証して組み立て直す。不正なら現在のデータを置き換えない。 */
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
    loop: s.loop === undefined ? false : bool(s.loop),
  } }
}
