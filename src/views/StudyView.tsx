import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useApp } from '../store.tsx'
import type { Session } from '../store.tsx'
import Icon from '../components/Icon.tsx'
import { hintText, markDifficult, requeue, retryDistance, shuffled } from '../lib/model.ts'
import type { StudyCard } from '../lib/model.ts'
import { back, WEAK_ID } from '../lib/route.ts'

/** turn: 何枚目のカードを出しているか（同じカードの再出題でも増える。めくりのアニメーション用） */
interface Run { queue: StudyCard[]; revealed: boolean; hints: number; again: number; againIds: string[]; round: number; turn: number }
type Action = { type: 'reveal' } | { type: 'hint' } | { type: 'ok' } | { type: 'again' } | { type: 'refill'; cards: StudyCard[] }

function reducer(s: Run, a: Action): Run {
  switch (a.type) {
    case 'reveal': return { ...s, revealed: true }
    case 'hint': return { ...s, hints: s.hints + 1 }
    case 'ok': return { ...s, queue: s.queue.slice(1), revealed: false, hints: 0, turn: s.turn + 1 }
    case 'again': {
      const id = s.queue[0]?.id
      return { ...s, queue: requeue(s.queue), revealed: false, hints: 0, turn: s.turn + 1, again: s.again + 1, againIds: id && !s.againIds.includes(id) ? [...s.againIds, id] : s.againIds }
    }
    case 'refill': return { ...s, queue: a.cards, revealed: false, hints: 0, round: s.round + 1, turn: s.turn + 1 }
  }
}

const sizeOf = (text: string) => text.length <= 14 ? 'xl' : text.length <= 40 ? 'lg' : text.length <= 120 ? 'md' : 'sm'
/** カードの後ろに見せる残りの束（0〜2 枚） */
const stackOf = (remaining: number) => `stack stack-${Math.min(2, Math.max(0, remaining))}`
const exitTo = (id: string) => id === WEAK_ID ? { name: 'library' as const } : { name: 'deck' as const, id }

export default function StudyView({ session, onRestart }: { session: Session; onRestart: (s: Session) => void }) {
  const { library, commit } = useApp()
  const { settings } = session
  const auto = settings.mode === 'auto'
  const [run, dispatch] = useReducer(reducer, { queue: session.cards, revealed: false, hints: 0, again: 0, againIds: [], round: 1, turn: 0 })
  const [notice, setNotice] = useState('')
  const weakIds = useMemo(() => new Set(library.decks.flatMap(d => d.cards.filter(c => c.difficult).map(c => c.id))), [library])
  const current = run.queue[0]
  const total = session.cards.length
  const position = Math.min(total, total - run.queue.length + 1)
  const exit = useCallback(() => back(exitTo(session.id)), [session.id])

  // 自動送りでループする場合は、終わったら最初から
  useEffect(() => {
    if (auto && settings.loop && !current && total) dispatch({ type: 'refill', cards: settings.shuffle ? shuffled(session.cards) : session.cards })
  }, [auto, settings.loop, settings.shuffle, current, total, session.cards])

  if (!current) return <Done session={session} run={run} weakIds={weakIds} onRestart={onRestart} onExit={exit} />

  const question = settings.direction === 'term' ? current.term : current.meaning
  const answer = settings.direction === 'term' ? current.meaning : current.term
  const hint = hintText(answer, run.hints)
  const revealed = run.revealed || (run.hints > 0 && run.hints >= hint.total)
  const weak = weakIds.has(current.id)

  const actions = {
    reveal: () => dispatch({ type: 'reveal' }),
    hint: () => dispatch({ type: 'hint' }),
    ok: () => { setNotice(''); dispatch({ type: 'ok' }) },
    again: () => {
      if (!commit(l => markDifficult(l, current.id, true))) return
      const n = retryDistance(run.queue.length - 1)
      setNotice(n === 0 ? 'もう一度出題します' : `${n} 枚あとにもう一度`)
      dispatch({ type: 'again' })
    },
    toggleWeak: () => commit(l => markDifficult(l, current.id, !weak)),
  }

  return <div className="study" style={{ '--c': session.color } as CSSProperties}>
    <header className="study-top">
      <button type="button" className="icon-btn" onClick={exit} aria-label="学習をやめる"><Icon name="close" /></button>
      <div className="study-title">
        <span className="study-name">{session.title}</span>
        <span className="study-mode">{auto ? `AUTO${settings.loop ? ` · LOOP ${run.round}` : ''}` : settings.direction === 'term' ? 'TERM → MEANING' : 'MEANING → TERM'}</span>
      </div>
      <span className="study-count" aria-label={`${total} 枚中 ${position} 枚目`}><b>{position}</b>/{total}</span>
    </header>
    <div className="progress" aria-hidden="true"><span style={{ width: `${(position / total) * 100}%` }} /></div>

    {auto
      ? <AutoCard key={run.turn} card={current} remaining={run.queue.length - 1} question={question} answer={answer} weak={weak} settings={settings} onReveal={actions.reveal} onNext={actions.ok} revealed={run.revealed} />
      : <>
        <div className={stackOf(run.queue.length - 1)}>
        <section key={run.turn} className={`flashcard ${revealed ? 'revealed' : ''}`} aria-label="カード">
          <div className="card-chrome">
            <span className="card-from" style={{ '--c': current.deckColor } as CSSProperties}>{current.deckTitle}</span>
            <button type="button" className={`weak-chip ${weak ? 'on' : ''}`} aria-pressed={weak} onClick={actions.toggleWeak} title="W">
              <Icon name="flag" size={14} filled={weak} />{weak ? 'WEAK' : 'MARK WEAK'}
            </button>
          </div>
          <button type="button" className="card-face" onClick={revealed ? undefined : actions.reveal} disabled={revealed} aria-label={revealed ? undefined : '答えを見る'}>
            <span className="face-label">{settings.direction === 'term' ? 'TERM' : 'MEANING'}</span>
            <span className={`face-text q ${sizeOf(question)}`}>{question}</span>
          </button>
          <div className="answer" aria-live="polite">
            <span className="face-label">{settings.direction === 'term' ? 'MEANING' : 'TERM'}</span>
            {revealed ? <span className={`face-text a ${sizeOf(answer)}`}>{answer}</span>
              : run.hints > 0 ? <span className={`face-text hint ${sizeOf(answer)}`}>{hint.text}</span>
                : <span className="answer-wait">TAP TO REVEAL</span>}
          </div>
          {revealed && weak && <p className="weak-note"><Icon name="flag" size={12} filled />苦手のまま。覚えたら WEAK をタップして外せます。</p>}
        </section>
        </div>

        <p className="study-notice" role="status">{notice && <><Icon name="again" size={14} />{notice}</>}</p>

        <div className="study-actions">
          {revealed ? <>
            <button type="button" className="btn again" onClick={actions.again}><Icon name="again" size={18} />AGAIN</button>
            <button type="button" className="btn primary" onClick={actions.ok}>OK<Icon name="arrow" size={18} /></button>
          </> : <>
            <button type="button" className="btn hint-btn" onClick={actions.hint}>HINT<span className="hint-count">{run.hints}/{hint.total}</span></button>
            <button type="button" className="btn primary" onClick={actions.reveal}>REVEAL</button>
          </>}
        </div>
        <Keys revealed={revealed} actions={actions} onExit={exit} />
      </>}
  </div>
}

/** 物理キーボード用。入力欄・ボタン上の Enter/Space はそちらを優先。 */
function Keys({ revealed, actions, onExit }: { revealed: boolean; actions: Record<'reveal' | 'hint' | 'ok' | 'again' | 'toggleWeak', () => void>; onExit: () => void }) {
  const ref = useRef({ revealed, actions, onExit })
  useEffect(() => { ref.current = { revealed, actions, onExit } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || t?.closest('input, textarea, select, dialog')) return
      const k = e.key.toLowerCase()
      if (t?.closest('button') && (k === ' ' || k === 'enter')) return
      const { revealed, actions, onExit } = ref.current
      const map: Record<string, (() => void) | undefined> = revealed
        ? { enter: actions.ok, arrowright: actions.ok, r: actions.again, arrowleft: actions.again, w: actions.toggleWeak, escape: onExit }
        : { ' ': actions.reveal, enter: actions.reveal, h: actions.hint, w: actions.toggleWeak, escape: onExit }
      const fn = map[k]
      if (fn) { e.preventDefault(); fn() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <p className="keys pointer-only" aria-hidden="true">
    {revealed ? <><span><kbd>Enter</kbd>OK</span><span><kbd>R</kbd>AGAIN</span></> : <><span><kbd>Space</kbd>REVEAL</span><span><kbd>H</kbd>HINT</span></>}
    <span><kbd>W</kbd>WEAK</span><span><kbd>Esc</kbd>EXIT</span>
  </p>
}

/** 自動送り: 問題 → 答え → 次へ。タップで一時停止。 */
function AutoCard({ card, remaining, question, answer, weak, settings, revealed, onReveal, onNext }: {
  card: StudyCard; remaining: number; question: string; answer: string; weak: boolean; settings: Session['settings']; revealed: boolean; onReveal: () => void; onNext: () => void
}) {
  const [paused, setPaused] = useState(false)
  const phaseMs = (revealed ? settings.answerSeconds : settings.questionSeconds) * 1000
  const timer = useRef({ remaining: phaseMs, startedAt: 0 })

  // フェーズが変わったら残り時間をリセット
  useEffect(() => { timer.current = { remaining: phaseMs, startedAt: performance.now() } }, [revealed, phaseMs])

  useEffect(() => {
    if (paused) return
    timer.current.startedAt = performance.now()
    const id = setTimeout(() => { if (revealed) onNext(); else onReveal() }, timer.current.remaining)
    return () => {
      clearTimeout(id)
      timer.current.remaining = Math.max(0, timer.current.remaining - (performance.now() - timer.current.startedAt))
    }
  }, [paused, revealed, onNext, onReveal])

  // 画面が隠れたら止める
  useEffect(() => {
    const onHide = () => { if (document.hidden) setPaused(true) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // 再生中は画面を消さない（対応ブラウザのみ）
  useEffect(() => {
    if (paused || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    navigator.wakeLock.request('screen').then(l => { if (cancelled) void l.release(); else lock = l }).catch(() => {})
    return () => { cancelled = true; void lock?.release().catch(() => {}) }
  }, [paused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, button, dialog')) return
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p) }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (revealed) onNext(); else onReveal() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, onNext, onReveal])

  return <>
    <div className={stackOf(remaining)}>
    <section className={`flashcard auto ${revealed ? 'revealed' : ''} ${paused ? 'paused' : ''}`} aria-label="カード">
      <div className="card-chrome">
        <span className="card-from" style={{ '--c': card.deckColor } as CSSProperties}>{card.deckTitle}</span>
        {weak && <span className="weak-chip on static"><Icon name="flag" size={14} filled />WEAK</span>}
      </div>
      <button type="button" className="card-face" onClick={() => setPaused(p => !p)} aria-label={paused ? '再開' : '一時停止'}>
        <span className={`face-text q ${sizeOf(question)}`}>{question}</span>
        <span className={`face-text a ${sizeOf(answer)} ${revealed ? '' : 'veiled'}`} aria-hidden={!revealed}>{answer}</span>
        {paused && <span className="paused-mark"><Icon name="pause" size={28} />PAUSED</span>}
      </button>
      <div className="phase" aria-hidden="true">
        <span key={`${revealed}`} className={revealed ? 'a' : 'q'} style={{ animationDuration: `${phaseMs}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
      </div>
    </section>
    </div>
    <div className="study-actions">
      <button type="button" className="btn" onClick={() => setPaused(p => !p)}>{paused ? <><Icon name="play" filled size={16} />RESUME</> : <><Icon name="pause" size={16} />PAUSE</>}</button>
      <button type="button" className="btn" onClick={() => { if (revealed) onNext(); else onReveal() }}><Icon name="skip" size={16} />{revealed ? 'NEXT' : 'SHOW'}</button>
    </div>
    <p className="keys pointer-only" aria-hidden="true"><span><kbd>Space</kbd>PAUSE</span><span><kbd>→</kbd>SKIP</span></p>
  </>
}

function Done({ session, run, weakIds, onRestart, onExit }: { session: Session; run: Run; weakIds: Set<string>; onRestart: (s: Session) => void; onExit: () => void }) {
  const weakNow = session.cards.filter(c => weakIds.has(c.id))
  const againCards = session.cards.filter(c => run.againIds.includes(c.id))
  const order = (cards: StudyCard[]) => session.settings.shuffle ? shuffled(cards) : cards
  return <div className="study done" style={{ '--c': session.color } as CSSProperties}>
    <div className="done-head">
      <div className="done-moai" aria-hidden="true">🗿</div>
      <h1 className="done-title">CARVED.</h1>
      <p className="lead">{session.title} を 1 周しました。</p>
    </div>
    <dl className="done-stats">
      <div><dt>CARDS</dt><dd>{session.cards.length}</dd></div>
      <div className={run.again ? 'again' : ''}><dt>AGAIN</dt><dd>{run.again}</dd></div>
      <div className={weakNow.length ? 'weak' : ''}><dt>WEAK</dt><dd>{weakNow.length}</dd></div>
    </dl>
    {againCards.length > 0 && <section className="done-list">
      <h2>AGAIN にしたカード</h2>
      <ul>{againCards.map(c => <li key={c.id}><span>{c.term}</span><span>{c.meaning}</span></li>)}</ul>
    </section>}
    <div className="done-actions">
      {weakNow.length > 0 && <button type="button" className="btn weak solid" onClick={() => onRestart({ ...session, cards: order(weakNow) })}><Icon name="flag" size={16} filled />WEAK だけもう一度 · {weakNow.length}</button>}
      <button type="button" className="btn" onClick={() => onRestart({ ...session, cards: order(session.cards) })}><Icon name="again" size={16} />もう一周</button>
      <button type="button" className="btn primary" onClick={onExit}>DONE</button>
    </div>
  </div>
}
