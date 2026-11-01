import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react'
import { useApp } from '../store.tsx'
import Icon from '../components/Icon.tsx'
import Sheet from '../components/Sheet.tsx'
import Segmented from '../components/Segmented.tsx'
import NotebookSheet from './NotebookSheet.tsx'
import ImportSheet from './ImportSheet.tsx'
import { ExportSheet } from './DataSheet.tsx'
import { addCards, cardsFor, deleteCard, deleteNotebook, markDifficult, plural, toggleFavorite, updateCard } from '../lib/model.ts'
import type { Notebook, Settings, StudyCard } from '../lib/model.ts'
import { exportTsv } from '../lib/tsv.ts'
import { back } from '../lib/route.ts'

type SheetState = { type: 'menu' } | { type: 'edit' } | { type: 'import' } | { type: 'export' } | { type: 'delete' } | { type: 'card'; card: StudyCard }

export default function DeckView({ notebook }: { notebook: Notebook }) {
  const { library, commit, mode } = useApp()
  const cards = cardsFor(library, notebook)
  const weak = cards.filter(c => c.difficult).length
  const isDeck = notebook.kind === 'deck'
  const blocked = mode === 'blocked'
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [composer, setComposer] = useState(isDeck && cards.length === 0)
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase()
  const visible = q ? cards.filter(c => `${c.term}\n${c.meaning}`.toLocaleLowerCase().includes(q)) : cards
  const sources = notebook.kind === 'compilation' ? notebook.deckIds.map(id => library.decks.find(d => d.id === id)).filter(d => !!d) : []

  return <div className="page" style={{ '--c': notebook.color } as CSSProperties}>
    <header className="topbar">
      <button type="button" className="icon-btn" onClick={() => back({ name: 'library' })} aria-label="一覧へ戻る"><Icon name="back" /></button>
      <span className="topbar-title">{isDeck ? 'DECK' : 'COMPILATION'}</span>
      <div className="topbar-actions">
        <button type="button" className={`icon-btn star ${notebook.favorite ? 'on' : ''}`} disabled={blocked} aria-pressed={notebook.favorite} aria-label="お気に入り" onClick={() => commit(l => toggleFavorite(l, notebook.id))}><Icon name="star" filled={notebook.favorite} /></button>
        <button type="button" className="icon-btn" onClick={() => setSheet({ type: 'menu' })} aria-label="単語帳のメニュー"><Icon name="more" /></button>
      </div>
    </header>

    <main className="content deck-layout">
      <section className="deck-head">
        <span className={`deck-swatch ${notebook.kind}`} aria-hidden="true" />
        <h1 className="deck-name">{notebook.title}</h1>
        <p className="deck-sub">
          <span>{plural(cards.length, 'card')}</span>
          <span className={weak ? 'weak' : 'muted'}><Icon name="flag" size={12} filled={!!weak} />{weak} weak</span>
        </p>
        {sources.length > 0 && <p className="sources-line">{sources.map(d => <span key={d.id} style={{ '--c': d.color } as CSSProperties}>{d.title}</span>)}</p>}
        {notebook.kind === 'compilation' && sources.length === 0 && <p className="note">まとめる単語帳がありません。メニューの EDIT から選んでください。</p>}
        <StudyPanel notebook={notebook} cards={cards} />
      </section>

      <section className="cards" aria-labelledby="cards-heading">
        <div className="section-head">
          <h2 id="cards-heading">CARDS <span className="count">{cards.length}</span></h2>
          {isDeck && <div className="section-actions">
            <button type="button" className="btn small" disabled={blocked} onClick={() => setSheet({ type: 'import' })}><Icon name="import" size={16} />IMPORT</button>
            <button type="button" className="btn small" aria-expanded={composer} disabled={blocked} onClick={() => setComposer(v => !v)}>{composer ? <><Icon name="close" size={16} />CLOSE</> : <><Icon name="plus" size={16} />ADD</>}</button>
          </div>}
        </div>

        {composer && isDeck && <Composer deckId={notebook.id} onClose={() => setComposer(false)} />}

        {cards.length > 6 && <label className="search wide">
          <Icon name="search" size={16} />
          <input id="card-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="SEARCH CARDS" aria-label="カードを検索" />
        </label>}

        {visible.length > 0 ? <ul className="card-list">
          {visible.map(c => <li key={c.id} className={`card-row ${c.difficult ? 'is-weak' : ''}`}>
            <button type="button" className="card-main" disabled={blocked} onClick={() => setSheet({ type: 'card', card: c })}>
              <span className="card-term">{c.term}</span>
              <span className="card-meaning">{c.meaning}</span>
              {!isDeck && <span className="card-source" style={{ '--c': c.deckColor } as CSSProperties}>{c.deckTitle}</span>}
            </button>
            <button type="button" className={`icon-btn flag ${c.difficult ? 'on' : ''}`} disabled={blocked} aria-pressed={c.difficult} aria-label={`「${c.term}」を苦手${c.difficult ? 'から外す' : 'にする'}`} onClick={() => commit(l => markDifficult(l, c.id, !c.difficult))}><Icon name="flag" filled={c.difficult} size={18} /></button>
          </li>)}
        </ul> : cards.length > 0 ? <p className="empty-line">「{query}」に一致するカードはありません。</p>
          : <p className="empty-line">{isDeck ? 'まだカードがありません。ADD で 1 枚ずつ、IMPORT で TSV をまとめて追加できます。' : '元の単語帳にカードを追加すると、ここに表示されます。'}</p>}
      </section>
    </main>

    {sheet?.type === 'menu' && <Sheet title={notebook.title} accent={notebook.color} onClose={() => setSheet(null)}>
      <div className="menu-list">
        <button type="button" className="menu-item" disabled={blocked} onClick={() => setSheet({ type: 'edit' })}><Icon name="edit" /><span><b>EDIT</b><small>{isDeck ? 'タイトルと色を変更' : 'タイトル・色・まとめる単語帳を変更'}</small></span></button>
        <button type="button" className="menu-item" disabled={!cards.length} onClick={() => setSheet({ type: 'export' })}><Icon name="export" /><span><b>EXPORT TSV</b><small>{cards.length} 枚をコピー／ダウンロード</small></span></button>
        <button type="button" className="menu-item danger" disabled={blocked} onClick={() => setSheet({ type: 'delete' })}><Icon name="trash" /><span><b>DELETE</b><small>{isDeck ? `カード ${cards.length} 枚と苦手の記録を削除` : 'このコンピレーションだけを削除（元の単語帳は残る）'}</small></span></button>
      </div>
    </Sheet>}
    {sheet?.type === 'edit' && <NotebookSheet initial={notebook} onClose={() => setSheet(null)} />}
    {sheet?.type === 'import' && <ImportSheet onClose={() => setSheet(null)} onImport={rows => commit(l => addCards(l, notebook.id, rows))} />}
    {sheet?.type === 'export' && <ExportSheet title="EXPORT TSV" filename={`${notebook.title}.tsv`} type="text/tab-separated-values;charset=utf-8" content={exportTsv(cards)} onClose={() => setSheet(null)} />}
    {sheet?.type === 'delete' && <DeleteSheet notebook={notebook} onClose={() => setSheet(null)} />}
    {sheet?.type === 'card' && <CardSheet card={sheet.card} viaCompilation={!isDeck} onClose={() => setSheet(null)} />}
  </div>
}

function StudyPanel({ notebook, cards }: { notebook: Notebook; cards: StudyCard[] }) {
  const { library, commit, startStudy, mode } = useApp()
  const [scope, setScope] = useState<'all' | 'weak'>('all')
  const s = library.settings
  const set = (patch: Partial<Settings>) => commit(l => ({ ...l, settings: { ...l.settings, ...patch } }), { silent: true })
  const weak = cards.filter(c => c.difficult)
  const target = scope === 'weak' ? weak : cards
  const clampSec = (n: number) => Math.min(60, Math.max(1, n))

  return <div className="study-panel">
    <div className="opt">
      <span className="label">QUIZ</span>
      <DirectionSwitch direction={s.direction} sample={cards[0]} onChange={direction => set({ direction })} />
    </div>
    <div className="opt">
      <span className="label">CARDS</span>
      <Segmented label="出題範囲" value={scope} onChange={setScope} options={[
        { value: 'all', label: <>ALL <span className="num">{cards.length}</span></> },
        { value: 'weak', label: <><Icon name="flag" size={12} filled />WEAK <span className="num">{weak.length}</span></>, disabled: weak.length === 0 },
      ]} />
    </div>
    <div className="opt">
      <span className="label">ORDER</span>
      <Segmented label="順番" value={s.shuffle ? 'shuffle' : 'order'} onChange={v => set({ shuffle: v === 'shuffle' })} options={[
        { value: 'shuffle', label: 'SHUFFLE' }, { value: 'order', label: 'IN ORDER' },
      ]} />
    </div>
    <div className="opt">
      <span className="label">MODE</span>
      <Segmented label="学習モード" value={s.mode} onChange={m => set({ mode: m })} options={[
        { value: 'manual', label: 'MANUAL' }, { value: 'auto', label: 'AUTO' },
      ]} />
    </div>
    {s.mode === 'auto' && <div className="auto-opts">
      <Stepper label="問題" value={s.questionSeconds} onChange={v => set({ questionSeconds: clampSec(v) })} />
      <Stepper label="答え" value={s.answerSeconds} onChange={v => set({ answerSeconds: clampSec(v) })} />
      <label className="toggle"><input type="checkbox" checked={s.loop} onChange={e => set({ loop: e.target.checked })} />LOOP</label>
    </div>}
    <button type="button" className="btn primary block start" disabled={!target.length || mode === 'blocked'} onClick={() => startStudy({ id: notebook.id, title: notebook.title, color: notebook.color, cards: target })}>
      <Icon name="play" filled size={18} />START<span className="start-count">{plural(target.length, 'card')}</span>
    </button>
    <p className="note">{s.mode === 'auto' ? '自動送り: 問題 → 答え → 次へ。画面タップで一時停止。苦手の記録は変わりません。' : 'AGAIN で苦手に登録して、少しあとにもう一度出題します。'}</p>
  </div>
}

/** 出題の向き。押すたびに入れ替わる。実際の 1 枚目で「何を見て、何を答えるか」を示す。 */
function DirectionSwitch({ direction, sample, onChange }: { direction: Settings['direction']; sample?: StudyCard; onChange: (d: Settings['direction']) => void }) {
  const [from, to] = direction === 'term' ? ['TERM', 'MEANING'] : ['MEANING', 'TERM']
  const shown = sample && (direction === 'term' ? sample.term : sample.meaning).split('\n')[0]
  return <button type="button" className="direction" onClick={() => onChange(direction === 'term' ? 'meaning' : 'term')}
    aria-label={`出題の向き: ${from === 'TERM' ? '単語を見て意味を答える' : '意味を見て単語を答える'}。押すと入れ替え`}>
    <span key={direction} className="direction-body">
      <span className="direction-main">{from}<Icon name="arrow" size={14} />{to}</span>
      {shown && <span className="direction-example"><span className="q">{shown}</span><span className="a">→ ?</span></span>}
    </span>
    <span className="direction-swap" aria-hidden="true"><Icon name="swap" size={18} /></span>
  </button>
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <div className="stepper" role="group" aria-label={`${label}の表示秒数`}>
    <span className="stepper-label">{label}</span>
    <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`${label}を1秒短く`}>−</button>
    <span className="stepper-value">{value}s</span>
    <button type="button" onClick={() => onChange(value + 1)} disabled={value >= 60} aria-label={`${label}を1秒長く`}>+</button>
  </div>
}

/** 連続入力用の追加フォーム。追加後は TERM に戻る。 */
function Composer({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { commit } = useApp()
  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
  const [last, setLast] = useState('')
  const termRef = useRef<HTMLTextAreaElement>(null)
  const valid = term.trim() && meaning.trim()
  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!valid) return
    if (commit(l => addCards(l, deckId, [{ term: term.trim(), meaning: meaning.trim() }]))) {
      setLast(term.trim()); setTerm(''); setMeaning(''); termRef.current?.focus()
    }
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }
  return <form className="composer" onSubmit={submit}>
    <label className="field">
      <span className="label">TERM <small>単語・問題</small></span>
      <textarea id="composer-term" ref={termRef} autoFocus rows={1} value={term} onChange={e => setTerm(e.target.value)} onKeyDown={onKey} placeholder="remember" />
    </label>
    <label className="field">
      <span className="label">MEANING <small>意味・答え</small></span>
      <textarea id="composer-meaning" rows={2} value={meaning} onChange={e => setMeaning(e.target.value)} onKeyDown={onKey} placeholder="覚えている、思い出す" />
    </label>
    <div className="composer-foot">
      <span className="note" role="status">{last ? <><Icon name="check" size={14} />「{last}」を追加</> : <span className="pointer-only">Ctrl / ⌘ + Enter で追加</span>}</span>
      <button type="button" className="btn small ghost" onClick={onClose}>DONE</button>
      <button type="submit" className="btn small primary" disabled={!valid}><Icon name="plus" size={16} />ADD</button>
    </div>
  </form>
}

function CardSheet({ card, viaCompilation, onClose }: { card: StudyCard; viaCompilation: boolean; onClose: () => void }) {
  const { commit } = useApp()
  const [term, setTerm] = useState(card.term)
  const [meaning, setMeaning] = useState(card.meaning)
  const [weak, setWeak] = useState(card.difficult)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const valid = term.trim() && meaning.trim()
  function submit(e: FormEvent) {
    e.preventDefault()
    if (valid && commit(l => updateCard(l, card.id, { term: term.trim(), meaning: meaning.trim(), difficult: weak }))) onClose()
  }
  return <Sheet title="EDIT CARD" accent={card.deckColor} onClose={onClose} footer={confirmDelete ? <>
    <span className="foot-text danger-text">このカードを削除しますか？</span>
    <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>KEEP</button>
    <button type="button" className="btn danger solid" onClick={() => { if (commit(l => deleteCard(l, card.id))) onClose() }}>DELETE</button>
  </> : <>
    <button type="button" className="btn ghost danger push-left" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} />DELETE</button>
    <button type="button" className="btn" onClick={onClose}>CANCEL</button>
    <button type="submit" form="card-form" className="btn primary" disabled={!valid}>SAVE</button>
  </>}>
    <form id="card-form" className="form" onSubmit={submit}>
      {viaCompilation && <p className="note">元の単語帳「{card.deckTitle}」のカードを編集します。</p>}
      <label className="field"><span className="label">TERM <small>単語・問題</small></span><textarea id="card-term" rows={2} value={term} onChange={e => setTerm(e.target.value)} /></label>
      <label className="field"><span className="label">MEANING <small>意味・答え</small></span><textarea id="card-meaning" rows={3} value={meaning} onChange={e => setMeaning(e.target.value)} /></label>
      <label className="toggle weak-toggle"><input type="checkbox" checked={weak} onChange={e => setWeak(e.target.checked)} /><Icon name="flag" size={16} filled={weak} />WEAK<small>苦手として記録する</small></label>
    </form>
  </Sheet>
}

function DeleteSheet({ notebook, onClose }: { notebook: Notebook; onClose: () => void }) {
  const { library, commit, toast } = useApp()
  const used = library.compilations.filter(c => c.deckIds.includes(notebook.id)).length
  return <Sheet title="DELETE" accent="var(--red)" onClose={onClose} footer={<>
    <button type="button" className="btn" onClick={onClose}>CANCEL</button>
    <button type="button" className="btn danger solid" onClick={() => { if (commit(l => deleteNotebook(l, notebook.id))) { onClose(); toast(`「${notebook.title}」を削除しました。`); back({ name: 'library' }) } }}>DELETE</button>
  </>}>
    <p className="lead">「{notebook.title}」を削除します。</p>
    <p className="note danger-text">{notebook.kind === 'deck'
      ? `カード ${notebook.cards.length} 枚と苦手の記録も消えます。${used ? `この単語帳を含むコンピレーション ${used} 件からも外れます。` : ''}元に戻せません。`
      : 'コンピレーションだけを削除します。元の単語帳とカードは残ります。'}</p>
  </Sheet>
}
