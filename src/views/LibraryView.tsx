import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useApp } from '../store.tsx'
import Icon from '../components/Icon.tsx'
import NotebookSheet from './NotebookSheet.tsx'
import DataSheet from './DataSheet.tsx'
import { allNotebooks, cardsFor, countCards, plural, toggleFavorite, weakCards } from '../lib/model.ts'
import type { Notebook } from '../lib/model.ts'
import { sampleLibrary } from '../lib/sample.ts'
import { go, WEAK_ID } from '../lib/route.ts'

type Filter = 'all' | 'starred'

export default function LibraryView() {
  const { library, commit, startStudy, mode } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<'new' | 'data' | null>(null)
  const notebooks = allNotebooks(library)
  const counts = countCards(library)
  const weak = weakCards(library)
  const weakDecks = new Set(weak.map(c => c.deckId)).size
  const q = query.trim().toLocaleLowerCase()
  const visible = notebooks
    .filter(n => (filter === 'all' || n.favorite) && n.title.toLocaleLowerCase().includes(q))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
  const blocked = mode === 'blocked'

  return <div className="page">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="memoaize">
        <span className="brand-moai" aria-hidden="true">🗿</span>
        <span className="brand-name">memoaize</span>
      </a>
      <div className="topbar-actions">
        <button type="button" className="btn primary small desktop-only" disabled={blocked} onClick={() => setSheet('new')}><Icon name="plus" size={16} />NEW DECK</button>
        <button type="button" className="icon-btn" onClick={() => setSheet('data')} aria-label="バックアップと書き出し"><Icon name="more" /></button>
      </div>
    </header>

    {notebooks.length === 0 ? <Empty onNew={() => setSheet('new')} /> : <main className="content">
      <p className="stats" aria-label="概要">
        <span><b>{library.decks.length}</b> DECKS</span>
        <span><b>{counts.cards}</b> CARDS</span>
        <span className={counts.weak ? 'weak' : ''}><b>{counts.weak}</b> WEAK</span>
      </p>

      {weak.length > 0 && <button type="button" className="weak-callout" disabled={blocked} onClick={() => startStudy({ id: WEAK_ID, title: '苦手まとめ', color: 'var(--orange)', cards: weak })}>
        <span className="weak-callout-icon"><Icon name="flag" filled /></span>
        <span className="grow">
          <b>REVIEW WEAK</b>
          <small>{weakDecks} 冊の苦手 {weak.length} 枚をまとめて復習</small>
        </span>
        <span className="play-chip"><Icon name="play" filled size={16} /></span>
      </button>}

      <div className="list-tools">
        <div className="tabs" role="group" aria-label="表示する単語帳">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>ALL <span>{notebooks.length}</span></button>
          <button type="button" aria-pressed={filter === 'starred'} onClick={() => setFilter('starred')}><Icon name="star" size={14} filled={filter === 'starred'} />STARRED <span>{notebooks.filter(n => n.favorite).length}</span></button>
        </div>
        {notebooks.length > 6 && <label className="search">
          <Icon name="search" size={16} />
          <input id="deck-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="SEARCH" aria-label="単語帳を検索" />
        </label>}
      </div>

      {visible.length ? <ul className="deck-list">
        {visible.map(n => <DeckRow key={n.id} notebook={n} blocked={blocked}
          onStar={() => commit(l => toggleFavorite(l, n.id))}
          onPlay={() => startStudy({ id: n.id, title: n.title, color: n.color, cards: cardsFor(library, n) })} />)}
      </ul> : <p className="empty-line">{filter === 'starred' && !q ? '★ を付けた単語帳はまだありません。' : `「${query}」に一致する単語帳はありません。`}</p>}
    </main>}

    {notebooks.length > 0 && <div className="bottom-bar mobile-only">
      <button type="button" className="btn primary block" disabled={blocked} onClick={() => setSheet('new')}><Icon name="plus" size={18} />NEW DECK</button>
    </div>}

    {sheet === 'new' && <NotebookSheet onClose={() => setSheet(null)} onSaved={n => go({ name: 'deck', id: n.id })} />}
    {sheet === 'data' && <DataSheet onClose={() => setSheet(null)} />}
  </div>
}

function DeckRow({ notebook: n, blocked, onStar, onPlay }: { notebook: Notebook; blocked: boolean; onStar: () => void; onPlay: () => void }) {
  const { library } = useApp()
  const cards = cardsFor(library, n)
  const weak = cards.filter(c => c.difficult).length
  const sources = n.kind === 'compilation' ? n.deckIds.map(id => library.decks.find(d => d.id === id)?.title).filter(Boolean) : []
  return <li className={`deck-row ${n.kind}`} style={{ '--c': n.color } as CSSProperties}>
    <a className="deck-main" href={`#deck-${n.id}`} onClick={e => { e.preventDefault(); go({ name: 'deck', id: n.id }) }}>
      <span className="deck-title">{n.title}</span>
      <span className="deck-meta">
        {n.kind === 'compilation' && <span className="kind">COMPILATION</span>}
        <span>{plural(cards.length, 'card')}</span>
        {weak > 0 && <span className="weak"><Icon name="flag" size={12} filled />{weak}</span>}
        {sources.length > 0 && <span className="sources">{sources.join(' + ')}</span>}
      </span>
    </a>
    <button type="button" className={`icon-btn star ${n.favorite ? 'on' : ''}`} disabled={blocked} aria-pressed={n.favorite} aria-label={`${n.title} をお気に入り${n.favorite ? 'から外す' : 'に追加'}`} onClick={onStar}><Icon name="star" filled={n.favorite} size={18} /></button>
    <button type="button" className="icon-btn play" disabled={!cards.length || blocked} aria-label={`${n.title} をすぐ学習`} onClick={onPlay}><Icon name="play" filled size={18} /></button>
  </li>
}

function Empty({ onNew }: { onNew: () => void }) {
  const { commit, toast, mode } = useApp()
  return <main className="content empty">
    <div className="empty-moai" aria-hidden="true">🗿</div>
    <h1 className="empty-title">NOTHING CARVED YET.</h1>
    <p className="lead">単語帳をつくって、覚えたいことを刻んでいこう。<br />AI に作らせた単語リストも、そのまま貼り付けて取り込めます。</p>
    <div className="empty-actions">
      <button type="button" className="btn primary" disabled={mode === 'blocked'} onClick={onNew}><Icon name="plus" size={18} />NEW DECK</button>
      <button type="button" className="btn" disabled={mode === 'blocked'} onClick={() => { if (commit(sampleLibrary())) toast('サンプルの単語帳を入れました。') }}>サンプルで試す</button>
    </div>
  </main>
}
