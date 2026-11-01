import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../store.tsx'
import Sheet from '../components/Sheet.tsx'
import Icon from '../components/Icon.tsx'
import { copyText, downloadFile } from '../lib/storage.ts'
import { exportTsv } from '../lib/tsv.ts'
import { countCards, validateLibrary } from '../lib/model.ts'
import type { Library } from '../lib/model.ts'
import { sampleLibrary } from '../lib/sample.ts'

/** バックアップ JSON を選んで、確認後に全体を置き換える */
export function RestoreButton({ className = 'btn', children }: { className?: string; children?: ReactNode }) {
  const { commit, toast } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Library | null>(null)
  async function read(file: File) {
    try { setPending(validateLibrary(JSON.parse(await file.text()))) }
    catch (e) { toast(e instanceof SyntaxError ? 'JSON として読み込めませんでした。現在のデータは変更していません。' : (e as Error).message, 'error') }
  }
  const counts = pending && countCards(pending)
  return <>
    <button type="button" className={className} onClick={() => input.current?.click()}>{children ?? <><Icon name="import" size={18} />バックアップから復元</>}</button>
    <input ref={input} type="file" hidden accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
    {pending && counts && <Sheet title="RESTORE" accent="var(--red)" onClose={() => setPending(null)} footer={<>
      <button type="button" className="btn" onClick={() => setPending(null)}>CANCEL</button>
      <button type="button" className="btn danger solid" onClick={() => { if (commit(pending, { replacing: true })) { setPending(null); toast('バックアップを復元しました。') } }}>REPLACE ALL</button>
    </>}>
      <p className="lead">単語帳 {pending.decks.length} 冊・カード {counts.cards} 枚・コンピレーション {pending.compilations.length} 件を復元します。</p>
      <p className="note danger-text">いまのデータはすべて置き換わります。</p>
    </Sheet>}
  </>
}

/** 出力内容を見せて、コピーかダウンロードを選べるようにする */
export function ExportSheet({ title, filename, content, type, onClose }: { title: string; filename: string; content: string; type: string; onClose: () => void }) {
  const { toast } = useApp()
  const area = useRef<HTMLTextAreaElement>(null)
  const lines = content ? content.split('\n').length : 0
  return <Sheet title={title} onClose={onClose} footer={<>
    <button type="button" className="btn" onClick={async () => {
      if (await copyText(content)) toast('コピーしました。')
      else { area.current?.select(); toast('テキストを選択しました。長押しなどでコピーしてください。') }
    }}>COPY</button>
    <button type="button" className="btn primary" onClick={() => downloadFile(filename, content, type)}><Icon name="export" size={18} />DOWNLOAD</button>
  </>}>
    <p className="note">{filename} · {type.startsWith('application/json') ? `${content.length.toLocaleString()} 文字` : `${lines} 行`}</p>
    <textarea ref={area} id="export-preview" className="code" readOnly rows={8} value={content} aria-label="出力内容" />
  </Sheet>
}

/** 一覧右上の「…」: バックアップ・復元・一括出力・サンプル */
export default function DataSheet({ onClose }: { onClose: () => void }) {
  const { library, commit, toast, mode } = useApp()
  const [exporting, setExporting] = useState<'backup' | 'tsv' | null>(null)
  const counts = countCards(library)
  if (exporting === 'backup') return <ExportSheet title="BACKUP" filename="memoaize-backup.json" type="application/json" content={JSON.stringify(library, null, 2)} onClose={onClose} />
  if (exporting === 'tsv') return <ExportSheet title="EXPORT ALL" filename="memoaize-all-cards.tsv" type="text/tab-separated-values;charset=utf-8" content={exportTsv(library.decks.flatMap(d => d.cards))} onClose={onClose} />
  return <Sheet title="DATA" onClose={onClose}>
    <p className="note">{mode === 'memory' ? '保存できない環境のため、データはこのページを閉じると消えます。' : 'データはこのブラウザの中だけに保存されます。機種変更やブラウザのデータ削除に備えて、ときどきバックアップしてください。'}</p>
    <div className="menu-list">
      <button type="button" className="menu-item" onClick={() => setExporting('backup')}>
        <Icon name="export" /><span><b>BACKUP</b><small>全データを JSON で保存（単語帳・苦手・設定）</small></span>
      </button>
      <RestoreButton className="menu-item"><Icon name="import" /><span><b>RESTORE</b><small>JSON バックアップから復元（いまのデータは置き換え）</small></span></RestoreButton>
      <button type="button" className="menu-item" disabled={!counts.cards} onClick={() => setExporting('tsv')}>
        <Icon name="export" /><span><b>EXPORT ALL TSV</b><small>全カード {counts.cards} 枚を 1 つの TSV に</small></span>
      </button>
      <button type="button" className="menu-item" onClick={() => {
        const sample = sampleLibrary()
        if (commit(l => ({ ...l, decks: [...l.decks, ...sample.decks], compilations: [...l.compilations, ...sample.compilations] }))) { toast('サンプルの単語帳を追加しました。'); onClose() }
      }}>
        <Icon name="plus" /><span><b>ADD SAMPLE DECKS</b><small>英単語・元素記号などのサンプルを追加</small></span>
      </button>
    </div>
  </Sheet>
}
