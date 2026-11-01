import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../store.tsx'
import Sheet from '../components/Sheet.tsx'
import Icon from '../components/Icon.tsx'
import { copyText, downloadFile } from '../lib/storage.ts'
import { exportTsv } from '../lib/tsv.ts'
import { countCards, emptyLibrary, validateLibrary } from '../lib/model.ts'
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

const BACKUP_NAME = 'memoaize-backup.json'

/** 全データを消す。消す前にその場でバックアップを保存できるようにする。 */
function ResetSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { library, commit, toast } = useApp()
  const [saved, setSaved] = useState(false)
  const [sure, setSure] = useState(false)
  const counts = countCards(library)
  const json = JSON.stringify(library, null, 2)
  return <Sheet title="RESET" accent="var(--red)" onClose={onClose} footer={<>
    <button type="button" className="btn" onClick={onClose}>CANCEL</button>
    <button type="button" className="btn danger solid" disabled={!sure} onClick={() => { if (commit(emptyLibrary(), { replacing: true })) { toast('すべてのデータを消去しました。'); onDone() } }}>
      <Icon name="trash" size={16} />RESET
    </button>
  </>}>
    <p className="lead">このブラウザの memoaize のデータをすべて消去します。</p>
    <p className="note danger-text">単語帳 {library.decks.length} 冊・コンピレーション {library.compilations.length} 件・カード {counts.cards} 枚と、苦手の記録・学習設定が消えます。元に戻せません。</p>
    <div className="reset-backup">
      <p className="label">BACKUP FIRST</p>
      <p className="note">消す前に、いまのデータを保存しておけます。あとで RESTORE から戻せます。</p>
      <div className="reset-backup-actions">
        <button type="button" className="btn small primary" onClick={() => { downloadFile(BACKUP_NAME, json); setSaved(true) }}><Icon name="export" size={16} />DOWNLOAD</button>
        <button type="button" className="btn small" onClick={async () => { if (await copyText(json)) { toast('バックアップをコピーしました。'); setSaved(true) } else toast('コピーできませんでした。DOWNLOAD を使ってください。', 'error') }}>COPY</button>
        {saved && <span className="note ok"><Icon name="check" size={14} />保存しました</span>}
      </div>
    </div>
    <label className="toggle confirm-toggle"><input id="reset-confirm" type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} />本当に消去する</label>
  </Sheet>
}

/** 一覧右上の「…」: バックアップ・復元・一括出力・サンプル・リセット */
export default function DataSheet({ onClose }: { onClose: () => void }) {
  const { library, commit, toast, mode } = useApp()
  const [view, setView] = useState<'backup' | 'tsv' | 'reset' | null>(null)
  const counts = countCards(library)
  const empty = library.decks.length === 0 && library.compilations.length === 0
  if (view === 'backup') return <ExportSheet title="BACKUP" filename={BACKUP_NAME} type="application/json" content={JSON.stringify(library, null, 2)} onClose={onClose} />
  if (view === 'tsv') return <ExportSheet title="EXPORT ALL" filename="memoaize-all-cards.tsv" type="text/tab-separated-values;charset=utf-8" content={exportTsv(library.decks.flatMap(d => d.cards))} onClose={onClose} />
  if (view === 'reset') return <ResetSheet onClose={() => setView(null)} onDone={onClose} />
  return <Sheet title="DATA" onClose={onClose}>
    <p className="note">{mode === 'memory' ? '保存できない環境のため、データはこのページを閉じると消えます。' : 'データはこのブラウザの中だけに保存されます。機種変更やブラウザのデータ削除に備えて、ときどきバックアップしてください。'}</p>
    <div className="menu-list">
      <button type="button" className="menu-item" onClick={() => setView('backup')}>
        <Icon name="export" /><span><b>BACKUP</b><small>全データを JSON で保存（単語帳・苦手・設定）</small></span>
      </button>
      <RestoreButton className="menu-item"><Icon name="import" /><span><b>RESTORE</b><small>JSON バックアップから復元（いまのデータは置き換え）</small></span></RestoreButton>
      <button type="button" className="menu-item" disabled={!counts.cards} onClick={() => setView('tsv')}>
        <Icon name="export" /><span><b>EXPORT ALL TSV</b><small>全カード {counts.cards} 枚を 1 つの TSV に</small></span>
      </button>
      <button type="button" className="menu-item" onClick={() => {
        const sample = sampleLibrary()
        if (commit(l => ({ ...l, decks: [...l.decks, ...sample.decks], compilations: [...l.compilations, ...sample.compilations] }))) { toast('サンプルの単語帳を追加しました。'); onClose() }
      }}>
        <Icon name="plus" /><span><b>ADD SAMPLE DECKS</b><small>英単語・元素記号などのサンプルを追加</small></span>
      </button>
      <button type="button" className="menu-item danger" disabled={empty} onClick={() => setView('reset')}>
        <Icon name="trash" /><span><b>RESET</b><small>すべてのデータを消去（消す前にバックアップできます）</small></span>
      </button>
    </div>
  </Sheet>
}
