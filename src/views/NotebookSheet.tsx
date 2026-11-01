import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../store.tsx'
import Sheet from '../components/Sheet.tsx'
import Segmented from '../components/Segmented.tsx'
import Icon from '../components/Icon.tsx'
import { COLORS, newId, saveNotebook } from '../lib/model.ts'
import type { Notebook } from '../lib/model.ts'

/** 単語帳・コンピレーションの作成と編集 */
export default function NotebookSheet({ initial, onClose, onSaved }: { initial?: Notebook; onClose: () => void; onSaved?: (notebook: Notebook) => void }) {
  const { library, commit } = useApp()
  const [kind, setKind] = useState<Notebook['kind']>(initial?.kind ?? 'deck')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[(library.decks.length + library.compilations.length) % COLORS.length])
  const [hex, setHex] = useState(color)
  const [deckIds, setDeckIds] = useState<string[]>(initial?.kind === 'compilation' ? initial.deckIds : [])
  const valid = title.trim().length > 0 && (kind === 'deck' || deckIds.length > 0)

  function pick(c: string) { setColor(c); setHex(c) }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const common = { id: initial?.id ?? newId(), title: title.trim(), color, favorite: initial?.favorite ?? false }
    const notebook: Notebook = kind === 'deck' ? { ...common, kind, cards: initial?.kind === 'deck' ? initial.cards : [] } : { ...common, kind, deckIds }
    if (commit(l => saveNotebook(l, notebook))) { onClose(); onSaved?.(notebook) }
  }

  return <Sheet title={initial ? 'EDIT' : 'NEW'} onClose={onClose} accent={color} footer={<>
    <button type="button" className="btn" onClick={onClose}>CANCEL</button>
    <button type="submit" form="notebook-form" className="btn primary" disabled={!valid}>{initial ? 'SAVE' : 'CREATE'}</button>
  </>}>
    <form id="notebook-form" className="form" onSubmit={submit}>
      {!initial && <div className="field">
        <span className="label">TYPE</span>
        <Segmented label="種類" value={kind} onChange={setKind} options={[{ value: 'deck', label: 'DECK' }, { value: 'compilation', label: 'COMPILATION', disabled: library.decks.length === 0 }]} />
        <small className="hint">{kind === 'deck' ? '単語帳: カードを直接追加します。' : 'コンピレーション: 既存の単語帳をまとめて学習します。元の単語帳の変更がそのまま反映されます。'}</small>
      </div>}
      <label className="field">
        <span className="label">TITLE</span>
        <input id="notebook-title" autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'deck' ? '例: 英単語 · 基本' : '例: 英語まとめ'} />
      </label>
      <div className="field">
        <span className="label">COLOR</span>
        <div className="swatches">
          {COLORS.map(c => <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={color === c} aria-label={`色 ${c}`} onClick={() => pick(c)}>{color === c && <Icon name="check" size={16} />}</button>)}
          <label className="swatch custom" style={{ background: COLORS.includes(color) ? undefined : color }} aria-label="カスタムカラー">
            <input type="color" value={color} onChange={e => pick(e.target.value)} />
            {!COLORS.includes(color) && <Icon name="check" size={16} />}
          </label>
          <input id="notebook-hex" className="hex" value={hex} maxLength={7} aria-label="カラーコード" spellCheck={false}
            onChange={e => { const v = e.target.value.trim(); setHex(v); if (/^#[\da-f]{6}$/i.test(v)) setColor(v.toLowerCase()) }} />
        </div>
      </div>
      {kind === 'compilation' && <fieldset className="field">
        <legend className="label">DECKS <span className="count">{deckIds.length}</span></legend>
        <div className="check-list">
          {library.decks.map(d => <label key={d.id} className="check-item">
            <input type="checkbox" checked={deckIds.includes(d.id)} onChange={e => setDeckIds(e.target.checked ? [...deckIds, d.id] : deckIds.filter(id => id !== d.id))} />
            <span className="dot" style={{ background: d.color }} />
            <span className="grow">{d.title}</span>
            <span className="muted">{d.cards.length}</span>
          </label>)}
        </div>
      </fieldset>}
    </form>
  </Sheet>
}
