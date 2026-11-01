import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { loadLibrary, saveLibrary } from './lib/storage.ts'
import type { LoadResult } from './lib/storage.ts'
import { sampleLibrary } from './lib/sample.ts'
import type { Library, Settings, StudyCard } from './lib/model.ts'

export type StorageMode = 'ok' | 'blocked' | 'memory'
export type Toast = { text: string; kind: 'info' | 'error'; id: number }

export interface Session {
  /** route の id（単語帳の id、または苦手まとめの 'weak'） */
  id: string
  title: string
  color: string
  cards: StudyCard[]
  settings: Settings
}

export interface AppApi {
  library: Library
  mode: StorageMode
  raw: string | null
  /** 保存して反映する。失敗したら通知して false。 */
  commit: (change: Library | ((current: Library) => Library), options?: { replacing?: boolean; silent?: boolean }) => boolean
  toast: (text: string, kind?: Toast['kind']) => void
  startStudy: (session: Omit<Session, 'settings'> & { settings?: Settings }) => void
}

export const AppContext = createContext<AppApi | null>(null)
export function useApp(): AppApi {
  const api = useContext(AppContext)
  if (!api) throw new Error('AppContext is missing')
  return api
}

function initialLoad(): LoadResult {
  const loaded = loadLibrary()
  // プレビュー用ビルドでは、空ならサンプルを入れた状態で開く
  if (import.meta.env.VITE_SEED_SAMPLE === '1' && (loaded.status === 'empty' || loaded.status === 'unavailable')) return { ...loaded, data: sampleLibrary() }
  return loaded
}

export function useLibraryStore() {
  const [loaded] = useState(initialLoad)
  const [library, setLibrary] = useState(loaded.data)
  const [mode, setMode] = useState<StorageMode>(loaded.status === 'corrupt' ? 'blocked' : loaded.status === 'unavailable' ? 'memory' : 'ok')
  const [toasts, setToasts] = useState<Toast[]>([])
  const current = useRef(library)
  const modeRef = useRef(mode)
  const seq = useRef(0)

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++seq.current
    setToasts(list => [...list.filter(t => t.kind === 'error'), { text, kind, id }].slice(-3))
    if (kind === 'info') setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 2600)
  }, [])
  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), [])

  const commit = useCallback<AppApi['commit']>((change, options = {}) => {
    const next = typeof change === 'function' ? change(current.current) : change
    if (modeRef.current === 'blocked' && !options.replacing) {
      toast('保存データを保護するため、編集を止めています。上の案内から復元か初期化を行ってください。', 'error')
      return false
    }
    if (modeRef.current !== 'memory') {
      try { saveLibrary(next) }
      catch (e) { if (!options.silent) toast((e as Error).message, 'error'); return false }
    }
    current.current = next
    setLibrary(next)
    if (modeRef.current === 'blocked') { modeRef.current = 'ok'; setMode('ok') }
    return true
  }, [toast])

  return { library, mode, raw: loaded.raw, commit, toast, toasts, dismiss }
}
