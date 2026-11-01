// PR #1 のテストを土台に、今回の変更（loop 設定・カード操作・苦手まとめ・ヒント）を追加。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addCards, cardsFor, characters, deleteCard, deleteNotebook, emptyLibrary, hintText, markDifficult, requeue, retryDistance, updateCard, validateLibrary, weakCards } from '../src/lib/model.ts'
import { exportTsv, parseTsv } from '../src/lib/tsv.ts'
import { loadLibrary, saveLibrary, STORAGE_KEY } from '../src/lib/storage.ts'

function fixture() {
  const state = emptyLibrary()
  state.decks = [{ id: 'deck-1', kind: 'deck', title: '英語', color: '#8b6fbc', favorite: false, cards: [
    { id: 'card-1', term: 'apple', meaning: 'りんご', difficult: false },
    { id: 'card-2', term: 'remember', meaning: '覚えている', difficult: true },
  ] }, { id: 'deck-2', kind: 'deck', title: '化学', color: '#87f57b', favorite: false, cards: [
    { id: 'card-3', term: 'Fe', meaning: '鉄', difficult: true },
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
  const edited = updateCard(marked, 'card-1', { meaning: '林檎' })
  assert.equal(cardsFor(edited, edited.compilations[0])[0].meaning, '林檎')
  const cleared = markDifficult(edited, 'card-1', false)
  assert.equal(cardsFor(cleared, cleared.compilations[0])[0].difficult, false)
})

test('苦手まとめは全単語帳の苦手カードを集める', () => {
  assert.deepEqual(weakCards(fixture()).map(c => c.id), ['card-2', 'card-3'])
  assert.equal(weakCards(fixture())[1].deckTitle, '化学')
})

test('カードの追加・削除、単語帳の削除でコンピレーションの参照を外す', () => {
  let state = addCards(fixture(), 'deck-2', [{ term: 'Na', meaning: 'ナトリウム' }])
  assert.equal(state.decks[1].cards.length, 2)
  assert.equal(state.decks[1].cards[1].difficult, false)
  state = deleteCard(state, 'card-3')
  assert.deepEqual(state.decks[1].cards.map(c => c.term), ['Na'])
  state = deleteNotebook(state, 'deck-1')
  assert.equal(state.decks.length, 1)
  assert.deepEqual(state.compilations[0].deckIds, [])
})

test('コンピレーションは同じ元カードを二重に含めない', () => {
  const state = fixture()
  assert.equal(cardsFor(state, { ...state.compilations[0], deckIds: ['deck-1', 'deck-1'] }).length, 2)
})

test('バックアップから全データと参照関係を復元できる', () => {
  const state = fixture()
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(state))), state)
})

test('loop を持たない古いバックアップも復元できる', () => {
  const old = JSON.parse(JSON.stringify(fixture()))
  delete old.settings.loop
  assert.equal(validateLibrary(old).settings.loop, false)
})

test('不正なバックアップ・重複ID・存在しない参照・不正設定を拒否する', () => {
  const bad = [null, {}, { ...fixture(), version: 2 }]
  let s = fixture(); s.compilations[0].deckIds = ['missing']; bad.push(s)
  s = fixture(); s.decks[0].cards[1].id = 'card-1'; bad.push(s)
  s = fixture(); s.settings.questionSeconds = null; bad.push(s)
  s = fixture(); s.settings.answerSeconds = 0; bad.push(s)
  s = fixture(); s.settings.shuffle = 'yes'; bad.push(s)
  s = fixture(); s.settings.loop = 'yes'; bad.push(s)
  s = fixture(); s.decks[0].color = 'red'; bad.push(s)
  s = fixture(); s.decks[0].cards[0].difficult = 'true'; bad.push(s)
  for (const value of bad) assert.throws(() => validateLibrary(value))
})

test('TSV はタブ・改行・引用符・日本語を含むカードを往復できる', () => {
  const cards = [{ term: 'hello', meaning: 'こんにちは' }, { term: 'two\twords', meaning: '一行目\n"二行目"' }]
  assert.deepEqual(parseTsv(exportTsv(cards)), cards)
  assert.deepEqual(parseTsv('﻿apple\tりんご\r\n\r\nremember\t覚える'), [{ term: 'apple', meaning: 'りんご' }, { term: 'remember', meaning: '覚える' }])
  assert.deepEqual(parseTsv('```tsv\napple\tりんご\n```'), [{ term: 'apple', meaning: 'りんご' }])
})

test('TSV の途中に不正な行があれば全体を拒否する', () => {
  for (const tsv of ['a\tb\nmissing', 'a\tb\tc', 'a\t', '\ta', '"a\tb', '"a"oops\tb']) assert.throws(() => parseTsv(tsv))
  assert.deepEqual(parseTsv(''), [])
})

test('ヒントで結合文字や絵文字の途中を分割せず、空白は数えない', () => {
  assert.deepEqual(characters('が🗿👨‍👩‍👧'), ['が', '🗿', '👨‍👩‍👧'])
  assert.deepEqual(hintText('覚える 事', 2), { text: '覚え_ _', total: 4 })
  assert.deepEqual(hintText('🗿ab', 1), { text: '🗿__', total: 3 })
})

function withStorage(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...value })
}

test('壊れた保存内容は読み込み時に上書きしない', t => {
  let writes = 0
  withStorage(t, { value: { getItem: () => '{broken', setItem: () => { writes++ } } })
  const result = loadLibrary()
  assert.equal(result.status, 'corrupt')
  assert.equal(result.raw, '{broken')
  assert.equal(writes, 0)
})

test('ブラウザ保存が使えない環境では unavailable として扱う', t => {
  withStorage(t, { get() { throw new Error('SecurityError') } })
  assert.equal(loadLibrary().status, 'unavailable')
})

test('保存容量エラーを通知し、正常な保存は読み直せる', t => {
  withStorage(t, { value: { getItem: () => null, setItem: () => { throw new Error('quota') } } })
  assert.throws(() => saveLibrary(fixture()), /保存できません/)
  const values = new Map()
  withStorage(t, { value: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) } })
  saveLibrary(fixture())
  assert.ok(values.get(STORAGE_KEY))
  assert.deepEqual(loadLibrary().data, fixture())
})
