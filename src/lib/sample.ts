import { emptyLibrary, newId } from './model.ts'
import type { Deck, Library } from './model.ts'

type Row = [term: string, meaning: string, weak?: 1]

function deck(title: string, color: string, rows: Row[], favorite = false): Deck {
  return { id: newId(), kind: 'deck', title, color, favorite, cards: rows.map(([term, meaning, weak]) => ({ id: newId(), term, meaning, difficult: !!weak })) }
}

/** 「サンプルで試す」用の単語帳。 */
export function sampleLibrary(): Library {
  const words = deck('英単語 · 基本', '#45ddf5', [
    ['remember', '覚えている、思い出す'],
    ['abandon', '（計画などを）断念する、見捨てる', 1],
    ['inevitable', '避けられない、必然の', 1],
    ['subtle', '微妙な、かすかな'],
    ['acquire', '（知識・技能を）習得する'],
    ['deliberate', '意図的な、慎重な', 1],
    ['reluctant', '気が進まない'],
    ['conceive', '（考えを）思いつく、想像する'],
    ['obscure', 'はっきりしない、無名の'],
    ['vivid', '鮮やかな、生き生きとした'],
    ['thrive', '繁栄する、よく育つ'],
    ['endure', '耐える、持ちこたえる'],
  ], true)
  const idioms = deck('英熟語', '#c099ff', [
    ['carry out', '実行する'],
    ['put up with', '我慢する', 1],
    ['look into', '調査する'],
    ['come up with', '（案を）思いつく'],
    ['give in', '屈する、降参する'],
    ['turn down', '断る、（音量を）下げる'],
  ])
  const elements = deck('元素記号', '#87f57b', [
    ['Na', 'ナトリウム'], ['K', 'カリウム'], ['Fe', '鉄'], ['Ag', '銀', 1],
    ['Hg', '水銀'], ['Pb', '鉛'], ['Sn', 'スズ'], ['W', 'タングステン'],
  ])
  const history = deck('日本史 · 年号', '#ff9d43', [
    ['大化の改新', '645年'], ['壬申の乱', '672年'], ['平安京遷都', '794年'],
    ['承久の乱', '1221年', 1], ['応仁の乱', '1467年'],
  ])
  return {
    ...emptyLibrary(),
    decks: [words, idioms, elements, history],
    compilations: [{ id: newId(), kind: 'compilation', title: '英語まとめ', color: '#f5da52', favorite: false, deckIds: [words.id, idioms.id] }],
  }
}
