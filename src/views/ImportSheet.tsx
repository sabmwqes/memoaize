import { useRef, useState } from 'react'
import { useApp } from '../store.tsx'
import Sheet from '../components/Sheet.tsx'
import Icon from '../components/Icon.tsx'
import { parseTsv } from '../lib/tsv.ts'
import type { ImportedCard } from '../lib/tsv.ts'
import { copyText } from '../lib/storage.ts'

export const AI_PROMPT = `次のテーマで暗記カードを作ってください。

出力の形式:
- TSV（タブ区切り）。1 行に「単語<TAB>意味」の 2 列だけ
- ヘッダー・番号・説明文は付けない
- セルの中で改行やタブを使うときは、そのセルを "..." で囲む

テーマ: `

export default function ImportSheet({ onImport, onClose }: { onImport: (cards: ImportedCard[]) => boolean; onClose: () => void }) {
  const { toast } = useApp()
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  let cards: ImportedCard[] = [], error = ''
  try { cards = parseTsv(text) } catch (e) { error = (e as Error).message }

  return <Sheet title="IMPORT" accent="var(--purple)" onClose={onClose} footer={<>
    <button type="button" className="btn" onClick={onClose}>CANCEL</button>
    <button type="button" className="btn primary" disabled={!!error || !!fileError || cards.length === 0} onClick={() => { if (onImport(cards)) { toast(`${cards.length} 枚を追加しました。`); onClose() } }}>
      <Icon name="plus" size={16} />ADD {cards.length || ''}
    </button>
  </>}>
    <ol className="steps">
      <li>
        <p><b>AI に頼む</b> 下のプロンプトをコピーして、テーマを書き足して送る</p>
        <textarea ref={promptRef} id="ai-prompt" className="code small" readOnly rows={4} value={AI_PROMPT} aria-label="AI 向けのプロンプト" />
        <button type="button" className="btn small" onClick={async () => {
          if (await copyText(AI_PROMPT)) toast('プロンプトをコピーしました。')
          else { promptRef.current?.select(); toast('テキストを選択しました。長押しなどでコピーしてください。') }
        }}>COPY PROMPT</button>
      </li>
      <li>
        <p><b>貼り付ける</b> 返ってきた TSV をそのまま（コードブロックごとでも OK）</p>
        <textarea id="import-text" className="code" rows={6} value={text} onChange={e => { setText(e.target.value); setFileError('') }} placeholder={'remember\t覚えている\nabandon\t断念する'} aria-label="TSV を貼り付け" />
        <label className="file-btn">
          <Icon name="import" size={16} />ファイルから読む (.tsv / .txt)
          <input type="file" accept=".tsv,.txt,text/tab-separated-values,text/plain" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''
            if (!file) return
            try { setText(await file.text()); setFileError('') } catch { setFileError('ファイルを読み込めませんでした。') }
          }} />
        </label>
      </li>
    </ol>
    {(error || fileError) && <p className="error-box" role="alert">{error || fileError}</p>}
    {cards.length > 0 && <div className="preview">
      <p className="preview-head">PREVIEW <span className="count">{cards.length}</span></p>
      <ul>{cards.slice(0, 6).map((c, i) => <li key={i}><span>{c.term}</span><span>{c.meaning}</span></li>)}</ul>
      {cards.length > 6 && <p className="note">ほか {cards.length - 6} 枚</p>}
    </div>}
  </Sheet>
}
