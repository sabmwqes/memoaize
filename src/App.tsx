import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CardEditor, NotebookEditor, TsvImporter } from './components/Editors.tsx'
import Modal from './components/Modal.tsx'
import Study, { StudySetup } from './components/Study.tsx'
import type { Session } from './components/Study.tsx'
import { cardsFor, emptyLibrary, markDifficult, newId, validateLibrary } from './lib/model.ts'
import type { Card, Library, Notebook } from './lib/model.ts'
import { downloadFile, loadLibrary, saveLibrary } from './lib/storage.ts'
import { exportTsv } from './lib/tsv.ts'
import './App.css'

type Editor = { type: 'notebook'; initial?: Notebook } | { type: 'card'; deckId: string; initial?: Card } | { type: 'import'; deckId: string } | { type: 'setup'; notebook: Notebook }
type Confirmation = { title: string; description: string; label: string; action: () => boolean }
type Filter = 'all' | 'favorites' | 'difficult'

export default function App() {
  const [loaded] = useState(loadLibrary)
  const [library, setLibrary] = useState(loaded.data)
  const [blocked, setBlocked] = useState(!!loaded.error)
  const [notice, setNotice] = useState({ text: loaded.error, error: !!loaded.error })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const all = [...library.decks, ...library.compilations]
  const selected = all.find(n => n.id === selectedId)
  const totalCards = library.decks.reduce((n, d) => n + d.cards.length, 0)
  const totalDifficult = library.decks.reduce((n, d) => n + d.cards.filter(c => c.difficult).length, 0)

  function commit(next: Library, replacing = false): boolean {
    try {
      if (blocked && !replacing) throw new Error('保存データを保護しています。先にバックアップからの復元または初期化を行ってください。')
      saveLibrary(next)
      setLibrary(next)
      setBlocked(false)
      setNotice({ text: 'このブラウザに保存しました。', error: false })
      return true
    } catch (e) { setNotice({ text: (e as Error).message, error: true }); return false }
  }
  function saveNotebook(notebook: Notebook): boolean {
    if (notebook.kind === 'deck') {
      const old = library.decks.find(d => d.id === notebook.id)
      const value = old ? { ...notebook, cards: old.cards } : notebook
      if (!commit({ ...library, decks: old ? library.decks.map(d => d.id === notebook.id ? value : d) : [...library.decks, value] })) return false
    } else if (!commit({ ...library, compilations: library.compilations.some(d => d.id === notebook.id) ? library.compilations.map(d => d.id === notebook.id ? notebook : d) : [...library.compilations, notebook] })) return false
    setSelectedId(notebook.id)
    return true
  }
  function updateCards(deckId: string, fn: (cards: Card[]) => Card[]) {
    return commit({ ...library, decks: library.decks.map(d => d.id === deckId ? { ...d, cards: fn(d.cards) } : d) })
  }
  function toggleFavorite(notebook: Notebook) {
    commit({ ...library, decks: library.decks.map(d => d.id === notebook.id ? { ...d, favorite: !d.favorite } : d), compilations: library.compilations.map(d => d.id === notebook.id ? { ...d, favorite: !d.favorite } : d) })
  }
  function removeNotebook(notebook: Notebook) {
    const used = library.compilations.filter(c => c.deckIds.includes(notebook.id))
    setConfirmation({ title: `「${notebook.title}」を削除`, description: notebook.kind === 'deck' ? `カード${notebook.cards.length}枚と苦手の記録を削除します。${used.length ? `参照している${used.length}件のコンピレーションからも外れます。` : ''}この操作は元に戻せません。` : 'コンピレーションだけを削除します。元の単語帳とカードは残ります。', label: 'DELETE', action: () => {
      const success = commit({ ...library, decks: library.decks.filter(d => d.id !== notebook.id), compilations: library.compilations.filter(d => d.id !== notebook.id).map(c => ({ ...c, deckIds: c.deckIds.filter(id => id !== notebook.id) })) })
      if (success) setSelectedId(null)
      return success
    } })
  }
  function backup() {
    downloadFile('memoaize-backup.json', JSON.stringify(library, null, 2))
    setNotice({ text: 'バックアップをダウンロードしました。別の端末でも復元できます。', error: false })
  }
  async function restore(file: File) {
    try {
      const next = validateLibrary(JSON.parse(await file.text()))
      const count = next.decks.reduce((n, d) => n + d.cards.length, 0)
      setNotice({ text: '', error: false })
      setConfirmation({ title: 'バックアップを復元', description: `単語帳${next.decks.length}件・カード${count}枚・コンピレーション${next.compilations.length}件を復元します。現在のデータ全体を置き換えます。必要なら先にバックアップしてください。`, label: 'RESTORE & REPLACE', action: () => {
        if (!commit(next, true)) return false
        setSelectedId(null); return true
      } })
    } catch (e) { setNotice({ text: e instanceof SyntaxError ? 'JSON ファイルを読み込めませんでした。現在のデータは変更していません。' : (e as Error).message, error: true }) }
  }
  function exportNotebook(notebook: Notebook) { downloadFile(`${notebook.title}.tsv`, exportTsv(cardsFor(library, notebook)), 'text/tab-separated-values;charset=utf-8') }
  function navigate(next: Filter) { setFilter(next); setSelectedId(null); setSearch('') }
  const currentCards = selected ? cardsFor(library, selected) : []
  const query = search.trim().toLocaleLowerCase()
  const visibleCards = currentCards.filter(c => (filter !== 'difficult' || c.difficult) && `${c.term} ${c.meaning}`.toLocaleLowerCase().includes(query))
  const visibleNotebooks = all.filter(n => (filter !== 'favorites' || n.favorite) && (filter !== 'difficult' || cardsFor(library, n).some(c => c.difficult)) && n.title.toLocaleLowerCase().includes(query)).sort((a, b) => Number(b.favorite) - Number(a.favorite))

  return <div className={session ? 'app-shell in-session' : 'app-shell'}>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); if (session) setSession(null); navigate('all') }}><span className="brand-mark">🗿</span><span>memoaize<small>BUILD YOUR MEMORY.</small></span></a>
      <span className="nav-label">WORKSPACE / 01</span>
      <nav aria-label="メインメニュー">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => navigate('all')}><span>▤</span>LIBRARY<b>{all.length}</b></button>
        <button className={filter === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')}><span>☆</span>STARRED<b>{all.filter(n => n.favorite).length}</b></button>
        <button className={filter === 'difficult' ? 'active' : ''} onClick={() => navigate('difficult')}><span>↻</span>REVIEW<b>{totalDifficult}</b></button>
      </nav>
      <div className="sidebar-bottom"><div className="storage-note"><span className="status-dot" />このブラウザに保存<p>学習の記録は、あなたの端末に。</p></div><button className="sidebar-action" onClick={backup} disabled={blocked}>↓ EXPORT BACKUP</button><button className="sidebar-action" onClick={() => restoreInput.current?.click()}>↑ RESTORE BACKUP</button><p className="sidebar-foot">MEMOAIZE / LOCAL FIRST</p></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><span>{session ? 'WORKSPACE / STUDY' : 'WORKSPACE / LIBRARY'}</span><span className="local-badge"><span className="status-dot" />LOCAL STORAGE</span></header>
      {notice.text && <div className={`notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}<button onClick={() => setNotice({ text: '', error: false })} aria-label="通知を閉じる">×</button></div>}
      {blocked && <div className="recovery"><p>保存データを保護するため、編集を停止しています。</p><button className="button secondary" onClick={() => downloadFile('memoaize-recovery.txt', loaded.raw ?? '')}>保存内容を退避する</button><button className="button secondary" onClick={() => setConfirmation({ title: '保存データを初期化', description: 'このブラウザの保存データを空にします。必要なら先に「保存内容を退避する」でファイルを保存してください。', label: 'RESET DATA', action: () => commit(emptyLibrary(), true) })}>初期化する</button></div>}
      {session ? <Study session={session} isDifficult={id => library.decks.some(d => d.cards.some(c => c.id === id && c.difficult))} onMark={(id, value) => commit(markDifficult(library, id, value))} onExit={() => setSession(null)} /> : <main className="workspace">
        {selected ? <>
          <button className="back-link" onClick={() => { setSelectedId(null); setSearch('') }}>← LIBRARY</button>
          <div className="page-heading"><div><span className="eyebrow">{selected.kind === 'compilation' ? 'COMPILATION' : 'YOUR NOTEBOOK'}</span><h1><span className="title-dot" style={{ background: selected.color }} />{selected.title}</h1><p>{currentCards.length}枚のカード · 苦手 {currentCards.filter(c => c.difficult).length}枚</p></div><button className="button primary" disabled={!currentCards.length || blocked} onClick={() => setEditor({ type: 'setup', notebook: selected })}>START STUDY →</button></div>
          {selected.kind === 'compilation' && <div className="compilation-note"><span>▧</span><div>単語帳をまとめたコンピレーション<p>{selected.deckIds.map(id => library.decks.find(d => d.id === id)?.title).join(' / ') || 'まとめる単語帳が選択されていません。'} · 元の単語帳の変更が反映されます。</p></div></div>}
          <div className="detail-toolbar"><div className="toolbar-actions">{selected.kind === 'deck' && <><button className="button secondary" disabled={blocked} onClick={() => setEditor({ type: 'card', deckId: selected.id })}>+ ADD CARD</button><button className="button secondary" disabled={blocked} onClick={() => setEditor({ type: 'import', deckId: selected.id })}>↑ IMPORT TSV</button></>}<button className="text-button" onClick={() => exportNotebook(selected)}>↓ EXPORT TSV</button></div><div className="toolbar-actions"><button className="text-button" disabled={blocked} onClick={() => setEditor({ type: 'notebook', initial: selected })}>EDIT</button><button className="text-button danger" disabled={blocked} onClick={() => removeNotebook(selected)}>DELETE</button></div></div>
          <div className="section-top"><h2>CARDS <span>{visibleCards.length}</span></h2><input className="search" aria-label="カードを検索" placeholder="SEARCH CARDS_" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {visibleCards.length ? <div className="card-table"><div className="table-heading"><span>TERM</span><span>MEANING</span><span>ACTIONS</span></div>{visibleCards.map(c => <div className="card-row" key={c.id}><div className="card-term">{c.term}{c.difficult && <span className="difficult-badge">REVIEW</span>}{selected.kind === 'compilation' && <small>{c.deckTitle}</small>}</div><div className="card-meaning">{c.meaning}</div><div className="card-actions">{selected.kind === 'deck' ? <><button className="text-button" disabled={blocked} onClick={() => setEditor({ type: 'card', deckId: selected.id, initial: c })}>EDIT</button><button className="text-button danger" disabled={blocked} onClick={() => setConfirmation({ title: 'カードを削除', description: `「${c.term}」と、このカードの苦手の記録を削除します。`, label: 'DELETE', action: () => updateCards(c.deckId, cards => cards.filter(card => card.id !== c.id)) })}>DELETE</button></> : <button className="text-button" onClick={() => { setSelectedId(c.deckId); setSearch('') }}>OPEN SOURCE →</button>}{c.difficult && <button className="text-button" disabled={blocked} onClick={() => commit(markDifficult(library, c.id, false))}>CLEAR REVIEW</button>}</div></div>)}</div> : <div className="empty-state compact"><span>▤</span><h2>{query ? '見つかりませんでした' : filter === 'difficult' ? '苦手カードはありません' : '最初のカードを追加しましょう'}</h2><p>{query ? '別の言葉で検索してみてください。' : selected.kind === 'compilation' ? '元の単語帳にカードを追加するか、組み合わせを編集できます。' : 'ひとつずつ追加しても、TSV でまとめて取り込んでも。'}</p></div>}
        </> : <>
          <div className="page-heading"><div><span className="eyebrow">MEMORY WORKSPACE</span><h1>{filter === 'favorites' ? 'STARRED' : filter === 'difficult' ? 'REVIEW QUEUE' : 'LIBRARY'}</h1><p>{filter === 'difficult' ? '苦手に登録したカードを、集中的に復習。' : '覚えたい知識を集めて、学習を開始。'}</p></div><button className="button primary" disabled={blocked} onClick={() => setEditor({ type: 'notebook' })}>+ NEW DECK</button></div>
          <section className="overview" aria-label="学習スペースの概要"><div><span className="overview-icon">▤</span><p><strong>{library.decks.length}</strong><span>DECKS</span></p></div><div><span className="overview-icon sage">▧</span><p><strong>{totalCards}</strong><span>CARDS</span></p></div><div><span className="overview-icon amber">↻</span><p><strong>{totalDifficult}</strong><span>REVIEW</span></p></div><div className="overview-message">LOCAL FIRST<br />NO ACCOUNT REQUIRED<span>↗</span></div></section>
          <div className="section-top"><h2>{filter === 'favorites' ? 'STARRED DECKS' : filter === 'difficult' ? 'NEEDS REVIEW' : 'ALL DECKS'} <span>{visibleNotebooks.length}</span></h2><input className="search" aria-label="単語帳を検索" placeholder="SEARCH DECKS_" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {visibleNotebooks.length ? <div className="notebook-grid">{visibleNotebooks.map(n => {
            const cards = cardsFor(library, n), difficult = cards.filter(c => c.difficult).length
            return <article key={n.id} className="notebook" style={{ '--notebook-color': n.color } as CSSProperties}>
              <div className="notebook-top"><span className="notebook-symbol">{n.kind === 'deck' ? '▤' : '▧'}</span><button className={`favorite ${n.favorite ? 'on' : ''}`} disabled={blocked} aria-label={`${n.title}をお気に入り${n.favorite ? 'から外す' : 'に登録'}`} aria-pressed={n.favorite} onClick={() => toggleFavorite(n)}>{n.favorite ? '★' : '☆'}</button></div>
              <span className="notebook-kind">{n.kind === 'deck' ? 'DECK' : 'COMPILATION'}</span><h3><button onClick={() => { setSelectedId(n.id); setSearch('') }}>{n.title}</button></h3><p className="notebook-count">{cards.length}枚のカード{n.kind === 'compilation' && ` · ${n.deckIds.length}冊をまとめて`}</p><div className="notebook-bottom"><span className={difficult ? 'weak-count' : 'muted'}>{difficult ? `↻ ${difficult} TO REVIEW` : 'READY TO STUDY'}</span><button className="study-link" disabled={!cards.length || blocked} onClick={() => setEditor({ type: 'setup', notebook: n })}>STUDY →</button></div>
            </article>
          })}<button className="new-notebook" disabled={blocked} onClick={() => setEditor({ type: 'notebook' })}><span>＋</span>NEW DECK</button></div> : <div className="empty-state"><span className="empty-moai">🗿</span><h2>{query ? 'NO RESULTS' : filter === 'favorites' ? 'NO STARRED DECKS' : filter === 'difficult' ? 'REVIEW QUEUE EMPTY' : 'YOUR NEXT KNOWLEDGE STARTS HERE.'}</h2><p>{query ? '別の名前で検索してみてください。' : filter === 'favorites' ? '単語帳の ☆ を押すと、ここに表示されます。' : filter === 'difficult' ? '学習中に「もう一度」を選ぶと、ここから振り返れます。' : '単語帳をつくって、ことばや知識をカードに。'}</p>{filter === 'all' && !query && <button className="button primary" disabled={blocked} onClick={() => setEditor({ type: 'notebook' })}>CREATE YOUR FIRST DECK →</button>}</div>}
          {totalCards > 0 && <div className="library-footer"><span>カードはこのブラウザに保存されます。</span><button className="text-button" onClick={() => downloadFile('memoaize-all-cards.tsv', exportTsv(library.decks.flatMap(d => d.cards)), 'text/tab-separated-values;charset=utf-8')}>EXPORT ALL TSV ↓</button></div>}
        </>}
      </main>}
    </div>
    <input ref={restoreInput} type="file" hidden accept=".json,application/json" aria-label="バックアップファイルを選択" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void restore(file) }} />
    {editor?.type === 'notebook' && <NotebookEditor library={library} initial={editor.initial} onSave={saveNotebook} onClose={() => setEditor(null)} />}
    {editor?.type === 'card' && <CardEditor initial={editor.initial} onClose={() => setEditor(null)} onSave={card => updateCards(editor.deckId, cards => editor.initial ? cards.map(c => c.id === card.id ? card : c) : [...cards, card])} />}
    {editor?.type === 'import' && <TsvImporter onClose={() => setEditor(null)} onImport={cards => updateCards(editor.deckId, existing => [...existing, ...cards.map(c => ({ ...c, id: newId(), difficult: false }))])} />}
    {editor?.type === 'setup' && <StudySetup title={editor.notebook.title} cards={cardsFor(library, editor.notebook)} settings={library.settings} onClose={() => setEditor(null)} onStart={next => { if (!commit({ ...library, settings: next.settings })) return false; setSession(next); setEditor(null); return true }} />}
    {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)}><p className="confirmation-text">{confirmation.description}</p>{notice.error && <p className="error" role="alert">{notice.text}</p>}<div className="modal-footer"><button className="button secondary" onClick={() => setConfirmation(null)}>CANCEL</button><button className="button danger-button" onClick={() => { if (confirmation.action()) setConfirmation(null) }}>{confirmation.label}</button></div></Modal>}
  </div>
}
