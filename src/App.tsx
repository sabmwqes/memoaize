import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppContext, useApp, useLibraryStore } from './store.tsx'
import type { AppApi, Session } from './store.tsx'
import { findNotebook, emptyLibrary, shuffled } from './lib/model.ts'
import { downloadFile } from './lib/storage.ts'
import { go, replace, useRoute, WEAK_ID } from './lib/route.ts'
import LibraryView from './views/LibraryView.tsx'
import DeckView from './views/DeckView.tsx'
import StudyView from './views/StudyView.tsx'
import Sheet from './components/Sheet.tsx'
import Icon from './components/Icon.tsx'
import { RestoreButton } from './views/DataSheet.tsx'

export default function App() {
  const store = useLibraryStore()
  const { library, commit, toast } = store
  const route = useRoute()
  const [session, setSession] = useState<Session | null>(null)
  const [runId, setRunId] = useState(0)
  const restart = useCallback((s: Session) => { setSession(s); setRunId(n => n + 1) }, [])

  const startStudy = useCallback<AppApi['startStudy']>(next => {
    const settings = next.settings ?? library.settings
    if (next.settings) commit(l => ({ ...l, settings }), { silent: true })
    restart({ ...next, settings, cards: settings.shuffle ? shuffled(next.cards) : next.cards })
    go({ name: 'study', id: next.id })
  }, [commit, library.settings, restart])

  const api = useMemo<AppApi>(() => ({ library, mode: store.mode, raw: store.raw, commit, toast, startStudy }), [library, store.mode, store.raw, commit, toast, startStudy])

  // 学習中に再読み込みした場合などは、セッションがないので単語帳へ戻す
  const studyLost = route.name === 'study' && (!session || session.id !== route.id)
  const missing = (route.name === 'deck' || (route.name === 'study' && route.id !== WEAK_ID)) && !findNotebook(library, route.id)
  useEffect(() => {
    if (missing) replace({ name: 'library' })
    else if (studyLost) replace(route.id === WEAK_ID ? { name: 'library' } : { name: 'deck', id: route.id })
  }, [missing, studyLost, route])

  let view
  if (route.name === 'study' && session && !studyLost) view = <StudyView key={runId} session={session} onRestart={restart} />
  else if (route.name !== 'library' && !missing) {
    const notebook = findNotebook(library, route.id)
    view = notebook ? <DeckView key={notebook.id} notebook={notebook} /> : null
  } else view = <LibraryView />

  return <AppContext.Provider value={api}>
    <div className="app">
      {store.mode === 'blocked' && <StorageBlocked />}
      {store.mode === 'memory' && <div className="banner warn" role="status">このブラウザでは保存できないため、ページを閉じると内容が消えます。</div>}
      {view}
      <div className="toasts" aria-live="polite">
        {store.toasts.map(t => <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span>{t.text}</span>
          <button type="button" className="icon-btn small" onClick={() => store.dismiss(t.id)} aria-label="通知を閉じる"><Icon name="close" size={16} /></button>
        </div>)}
      </div>
    </div>
  </AppContext.Provider>
}

function StorageBlocked() {
  const store = useApp()
  const [confirm, setConfirm] = useState(false)
  return <div className="banner error" role="alert">
    <p>保存データを読み込めませんでした。上書きしないよう、編集を止めています。</p>
    <div className="banner-actions">
      <button type="button" className="btn small" onClick={() => downloadFile('memoaize-recovery.txt', store.raw ?? '', 'text/plain')}>保存内容を退避</button>
      <RestoreButton className="btn small" />
      <button type="button" className="btn small danger" onClick={() => setConfirm(true)}>初期化</button>
    </div>
    {confirm && <Sheet title="RESET DATA" accent="var(--red)" onClose={() => setConfirm(false)} footer={<>
      <button type="button" className="btn" onClick={() => setConfirm(false)}>CANCEL</button>
      <button type="button" className="btn danger solid" onClick={() => { if (store.commit(emptyLibrary(), { replacing: true })) setConfirm(false) }}>RESET</button>
    </>}>
      <p className="lead">このブラウザの保存データを空にします。必要なら先に「保存内容を退避」でファイルを保存してください。</p>
    </Sheet>}
  </div>
}
