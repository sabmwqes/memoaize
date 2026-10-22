import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardsFor, characters, emptyLibrary, markDifficult, requeue, retryDistance, validateLibrary } from '../src/lib/model.ts'
import { exportTsv, parseTsv } from '../src/lib/tsv.ts'
import { loadLibrary, saveLibrary, STORAGE_KEY } from '../src/lib/storage.ts'

function fixture() {
  const state = emptyLibrary()
  state.decks = [{ id: 'deck-1', kind: 'deck', title: '英語', color: '#8b6fbc', favorite: false, cards: [
    { id: 'card-1', term: 'apple', meaning: 'りんご', difficult: false },
    { id: 'card-2', term: 'remember', meaning: '覚えている', difficult: true },
  ] }]
  state.compilations = [{ id: 'comp-1', kind: 'compilation', title: 'まとめ', color: '#648ca6', favorite: true, deckIds: ['deck-1'] }]
  return state
}

test('再出題は残り枚数に応じて伸び、少数でもカードが欠落・重複しない', () => {
  for (const [remaining, expected] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 3], [6, 3], [7, 4], [20, 10], [101, 51]]) {
    assert.equal(retryDistance(remaining), expected)
    const queue = ['retry', ...Array.from({ length: remaining }, (_, i) => `c${i}`)]
    const next = requeue(queue)
    assert.equal(next.indexOf('retry'), expected)
    assert.equal(next.length, queue.length)
    assert.deepEqual([...next].sort(), [...queue].sort())
    assert.equal(queue[0], 'retry', '元のキューは変更しない')
  }
  assert.deepEqual(requeue([]), [])
})

test('苦手の記録とカード編集はコンピレーションにも反映される', () => {
  const state = fixture()
  const marked = markDifficult(state, 'card-1', true)
  assert.equal(cardsFor(marked, marked.compilations[0])[0].difficult, true)
  assert.equal(state.decks[0].cards[0].difficult, false)
  marked.decks[0].cards[0].meaning = '林檎'
  assert.equal(cardsFor(marked, marked.compilations[0])[0].meaning, '林檎')
  const cleared = markDifficult(marked, 'card-1', false)
  assert.equal(cardsFor(cleared, cleared.compilations[0])[0].difficult, false)
})

test('コンピレーションは同じ元カードを二重に含めない', () => {
  const state = fixture()
  assert.equal(cardsFor(state, { ...state.compilations[0], deckIds: ['deck-1', 'deck-1'] }).length, 2)
})

test('バックアップから全データと参照関係を復元できる', () => {
  const state = fixture()
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(state))), state)
})

test('不正なバックアップ・重複ID・存在しない参照・不正設定を拒否する', () => {
  const bad = [null, {}, { ...fixture(), version: 2 }]
  let s = fixture(); s.compilations[0].deckIds = ['missing']; bad.push(s)
  s = fixture(); s.decks[0].cards[1].id = 'card-1'; bad.push(s)
  s = fixture(); s.settings.questionSeconds = null; bad.push(s)
  s = fixture(); s.settings.answerSeconds = 0; bad.push(s)
  s = fixture(); s.settings.shuffle = 'yes'; bad.push(s)
  s = fixture(); s.decks[0].color = 'red'; bad.push(s)
  s = fixture(); s.decks[0].cards[0].difficult = 'true'; bad.push(s)
  for (const value of bad) assert.throws(() => validateLibrary(value))
})

test('TSV はタブ・改行・引用符・日本語を含むカードを往復できる', () => {
  const cards = [{ term: 'hello', meaning: 'こんにちは' }, { term: 'two\twords', meaning: '一行目\n"二行目"' }]
  assert.deepEqual(parseTsv(exportTsv(cards)), cards)
  assert.deepEqual(parseTsv('\uFEFFapple\tりんご\r\n\r\nremember\t覚える'), [{ term: 'apple', meaning: 'りんご' }, { term: 'remember', meaning: '覚える' }])
  assert.deepEqual(parseTsv('```tsv\napple\tりんご\n```'), [{ term: 'apple', meaning: 'りんご' }])
})

test('TSV の途中に不正な行があれば全体を拒否する', () => {
  for (const tsv of ['a\tb\nmissing', 'a\tb\tc', 'a\t', '\ta', '"a\tb', '"a"oops\tb']) assert.throws(() => parseTsv(tsv))
  assert.deepEqual(parseTsv(''), [])
})

test('ヒントで結合文字や絵文字の途中を分割しない', () => {
  assert.deepEqual(characters('か\u3099🗿👨‍👩‍👧'), ['か\u3099', '🗿', '👨‍👩‍👧'])
})

test('壊れた保存内容は読み込み時に上書きしない', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage })
  let writes = 0
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{broken', setItem: () => { writes++ } } })
  const result = loadLibrary()
  assert.ok(result.error)
  assert.equal(result.raw, '{broken')
  assert.equal(writes, 0)
})

test('保存容量エラーを通知し、正常な保存は読み直せる', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => { throw new Error('quota') } } })
  assert.throws(() => saveLibrary(fixture()), /保存できません/)
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) } })
  saveLibrary(fixture())
  assert.ok(values.get(STORAGE_KEY))
  assert.deepEqual(loadLibrary().data, fixture())
})
