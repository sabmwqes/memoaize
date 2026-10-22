import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from './Modal.tsx'
import { COLORS, newId } from '../lib/model.ts'
import type { Card, Library, Notebook } from '../lib/model.ts'
import { parseTsv } from '../lib/tsv.ts'

export function NotebookEditor({ library, initial, onSave, onClose }: { library: Library; initial?: Notebook; onSave: (notebook: Notebook) => boolean; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[(library.decks.length + library.compilations.length) % COLORS.length])
  const [kind, setKind] = useState<'deck' | 'compilation'>(initial?.kind ?? 'deck')
  const [deckIds, setDeckIds] = useState<string[]>(initial?.kind === 'compilation' ? initial.deckIds : [])
  const [saveError, setSaveError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const common = { id: initial?.id ?? newId(), title: title.trim(), color, favorite: initial?.favorite ?? false }
    const notebook: Notebook = kind === 'deck'
      ? { ...common, kind, cards: initial?.kind === 'deck' ? initial.cards : [] }
      : { ...common, kind, deckIds }
    if (onSave(notebook)) onClose()
    else setSaveError('保存できませんでした。ブラウザの保存容量や設定を確認してください。入力内容はそのまま残っています。')
  }
  return <Modal title={initial ? 'EDIT DECK' : 'NEW DECK'} onClose={onClose}>
    <form onSubmit={submit}>
      {!initial && <fieldset><legend>種類</legend><div className="segmented">
        <button type="button" className={kind === 'deck' ? 'selected' : ''} aria-pressed={kind === 'deck'} onClick={() => setKind('deck')}>DECK</button>
        <button type="button" className={kind === 'compilation' ? 'selected' : ''} aria-pressed={kind === 'compilation'} onClick={() => setKind('compilation')}>COMPILATION</button>
      </div></fieldset>}
      <label className="field">タイトル<input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="例：英語の日常表現" /></label>
      <fieldset><legend>色</legend><div className="color-options">{COLORS.map(c => <button type="button" key={c} style={{ background: c }} className={`color-option ${color === c ? 'active' : ''}`} onClick={() => setColor(c)} aria-label={`色 ${c}`} aria-pressed={color === c}>{color === c ? '✓' : ''}</button>)}<label className="custom-color">カスタム<input aria-label="カスタムカラー" type="color" value={color} onChange={e => setColor(e.target.value)} /></label></div></fieldset>
      {kind === 'compilation' && <fieldset><legend>まとめる単語帳</legend><p className="help">元の単語帳を更新すると、ここにも反映されます。</p>
        {library.decks.length === 0 ? <p className="help">先に通常の単語帳を作成してください。</p> : library.decks.map(d => <label className="check-row" key={d.id}><input type="checkbox" checked={deckIds.includes(d.id)} onChange={e => setDeckIds(e.target.checked ? [...deckIds, d.id] : deckIds.filter(id => id !== d.id))} /><span className="dot" style={{ background: d.color }} />{d.title}<span className="muted">{d.cards.length}枚</span></label>)}
      </fieldset>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
      <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>CANCEL</button><button className="button primary" disabled={!title.trim()}>{initial ? 'SAVE' : 'CREATE'}</button></div>
    </form>
  </Modal>
}

export function CardEditor({ initial, onSave, onClose }: { initial?: Card; onSave: (card: Card) => boolean; onClose: () => void }) {
  const [term, setTerm] = useState(initial?.term ?? '')
  const [meaning, setMeaning] = useState(initial?.meaning ?? '')
  const [saveError, setSaveError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!term.trim() || !meaning.trim()) return
    if (onSave({ id: initial?.id ?? newId(), difficult: initial?.difficult ?? false, term: term.trim(), meaning: meaning.trim() })) onClose()
    else setSaveError('保存できませんでした。ブラウザの保存容量や設定を確認してください。入力内容はそのまま残っています。')
  }
  return <Modal title={initial ? 'EDIT CARD' : 'NEW CARD'} onClose={onClose}><form onSubmit={submit}>
    <label className="field">単語・問題<textarea autoFocus required rows={3} value={term} onChange={e => setTerm(e.target.value)} placeholder="覚えたい単語や質問" /></label>
    <label className="field">意味・答え<textarea required rows={4} value={meaning} onChange={e => setMeaning(e.target.value)} placeholder="意味や答え" /></label>
    {saveError && <p className="error" role="alert">{saveError}</p>}
    <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>CANCEL</button><button className="button primary" disabled={!term.trim() || !meaning.trim()}>SAVE</button></div>
  </form></Modal>
}

export function TsvImporter({ onImport, onClose }: { onImport: (cards: { term: string; meaning: string }[]) => boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const [saveError, setSaveError] = useState('')
  let cards: { term: string; meaning: string }[] = [], error = ''
  try { cards = parseTsv(text) } catch (e) { error = (e as Error).message }
  return <Modal title="IMPORT TSV" onClose={onClose} wide>
    <p className="help">単語と意味をタブで区切った、ヘッダーなしの2列形式です。既存のカードに追加します。</p>
    <label className="file-picker">SELECT FILE<input type="file" accept=".tsv,.txt,text/tab-separated-values,text/plain" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return
      try { setText(await file.text()); setFileError('') } catch { setFileError('ファイルを読み込めませんでした。') }
    }} /></label>
    <label className="field">またはテキストを貼り付け<textarea className="mono" rows={7} value={text} onChange={e => { setText(e.target.value); setFileError('') }} placeholder={'apple\tりんご\nremember\t覚えている'} /></label>
    <details className="import-help"><summary>AI に作成を頼むときの例</summary><p>「単語と意味の2列をタブで区切った TSV を、ヘッダーと説明なしで出力してください。セル内に改行・タブ・引用符がある場合は CSV と同じ引用規則を使ってください。」</p></details>
    {(error || fileError || saveError) && <p className="error" role="alert">{error || fileError || saveError}</p>}
    {cards.length > 0 && <div className="import-preview"><strong>プレビュー · {cards.length}枚</strong>{cards.slice(0, 5).map((c, i) => <div key={i}><span>{c.term}</span><span>{c.meaning}</span></div>)}{cards.length > 5 && <p className="help">ほか {cards.length - 5}枚</p>}</div>}
    <div className="modal-footer"><button className="button secondary" onClick={onClose}>CANCEL</button><button className="button primary" disabled={!!error || !!fileError || cards.length === 0} onClick={() => { if (onImport(cards)) onClose(); else setSaveError('保存できませんでした。ブラウザの保存容量や設定を確認してください。') }}>{cards.length}枚を追加する</button></div>
  </Modal>
}
