import { emptyLibrary, validateLibrary } from './model.ts'
import type { Library } from './model.ts'

export const STORAGE_KEY = 'memoaize.library.v1'
export function loadLibrary(): { data: Library; error: string; raw: string | null } {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    return { data: raw === null ? emptyLibrary() : validateLibrary(JSON.parse(raw)), error: '', raw }
  } catch {
    return { data: emptyLibrary(), raw, error: '保存データを読み込めませんでした。元のデータは上書きしていません。バックアップから復元するか、保存内容を退避してから初期化してください。' }
  }
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
