import { emptyLibrary, validateLibrary } from './model.ts'
import type { Library } from './model.ts'

export const STORAGE_KEY = 'memoaize.library.v1'

/**
 * ok: 読み込めた / empty: まだ保存がない
 * corrupt: 読めない保存内容がある（上書きしないよう編集を止める）
 * unavailable: ブラウザ保存そのものが使えない（その場限りで動かす）
 */
export type LoadStatus = 'ok' | 'empty' | 'corrupt' | 'unavailable'
export interface LoadResult { data: Library; status: LoadStatus; raw: string | null }

export function loadLibrary(): LoadResult {
  let raw: string | null
  try { raw = localStorage.getItem(STORAGE_KEY) }
  catch { return { data: emptyLibrary(), status: 'unavailable', raw: null } }
  if (raw === null) return { data: emptyLibrary(), status: 'empty', raw }
  try { return { data: validateLibrary(JSON.parse(raw)), status: 'ok', raw } }
  catch { return { data: emptyLibrary(), status: 'corrupt', raw } }
}

export function saveLibrary(data: Library): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  catch { throw new Error('保存できませんでした。ブラウザの保存容量や設定を確認してください。この操作は反映していません。') }
}

export function downloadFile(name: string, content: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = Array.from(name, char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true }
  catch { return false }
}
