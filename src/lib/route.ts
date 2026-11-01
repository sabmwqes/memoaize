import { useSyncExternalStore } from 'react'

/** URL のハッシュで画面を表す。ブラウザ／スマホの「戻る」で前の画面に戻れる。 */
export type Route = { name: 'library' } | { name: 'deck'; id: string } | { name: 'study'; id: string }

export const WEAK_ID = 'weak'

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '')
  if (h.startsWith('deck-')) return { name: 'deck', id: h.slice(5) }
  if (h.startsWith('study-')) return { name: 'study', id: h.slice(6) }
  return { name: 'library' }
}

const toUrl = (route: Route) => route.name === 'library' ? location.pathname + location.search : `#${route.name}-${route.id}`

const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())
function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  window.addEventListener('hashchange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener('hashchange', listener)
  }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseRoute(hash)
}

/** 新しい画面へ進む（履歴に積む） */
export function go(route: Route) {
  history.pushState({ memoaize: true }, '', toUrl(route))
  notify()
}

/** アプリ内で積んだ履歴があれば戻る。なければ fallback に置き換える。 */
export function back(fallback: Route) {
  if ((history.state as { memoaize?: boolean } | null)?.memoaize) history.back()
  else replace(fallback)
}

export function replace(route: Route) {
  history.replaceState(null, '', toUrl(route))
  notify()
}
