import { useEffect, useReducer, useState } from 'react'
import Modal from './Modal.tsx'
import { characters, requeue, retryDistance, shuffled } from '../lib/model.ts'
import type { Settings, StudyCard } from '../lib/model.ts'

export interface Session { title: string; cards: StudyCard[]; settings: Settings }

export function StudySetup({ title, cards, settings, onStart, onClose }: { title: string; cards: StudyCard[]; settings: Settings; onStart: (session: Session) => boolean; onClose: () => void }) {
  const [options, setOptions] = useState(settings)
  const [difficultOnly, setDifficultOnly] = useState(false)
  const [saveError, setSaveError] = useState('')
  const selected = difficultOnly ? cards.filter(c => c.difficult) : cards
  return <Modal title="START STUDY" onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); if (selected.length && !onStart({ title, cards: options.shuffle ? shuffled(selected) : [...selected], settings: options })) setSaveError('設定を保存できませんでした。ブラウザの保存容量や設定を確認してください。') }}>
      <p className="setup-title">{title}<span className="badge">{selected.length}枚</span></p>
      <fieldset><legend>SCOPE</legend><div className="segmented"><button type="button" className={!difficultOnly ? 'selected' : ''} onClick={() => setDifficultOnly(false)}>ALL · {cards.length}</button><button type="button" className={difficultOnly ? 'selected' : ''} onClick={() => setDifficultOnly(true)}>REVIEW · {cards.filter(c => c.difficult).length}</button></div></fieldset>
      <fieldset><legend>DIRECTION</legend><div className="segmented"><button type="button" className={options.direction === 'term' ? 'selected' : ''} onClick={() => setOptions({ ...options, direction: 'term' })}>TERM → MEANING</button><button type="button" className={options.direction === 'meaning' ? 'selected' : ''} onClick={() => setOptions({ ...options, direction: 'meaning' })}>MEANING → TERM</button></div></fieldset>
      <label className="check-row spaced"><span>SHUFFLE</span><input type="checkbox" checked={options.shuffle} onChange={e => setOptions({ ...options, shuffle: e.target.checked })} /></label>
      <fieldset><legend>MODE</legend><div className="segmented"><button type="button" className={options.mode === 'manual' ? 'selected' : ''} onClick={() => setOptions({ ...options, mode: 'manual' })}>MANUAL</button><button type="button" className={options.mode === 'auto' ? 'selected' : ''} onClick={() => setOptions({ ...options, mode: 'auto' })}>AUTO</button></div></fieldset>
      {options.mode === 'auto' && <div className="two-columns"><label className="field">問題の表示（秒）<input required type="number" min={1} max={60} value={options.questionSeconds} onChange={e => setOptions({ ...options, questionSeconds: e.target.valueAsNumber })} /></label><label className="field">答えの表示（秒）<input required type="number" min={1} max={60} value={options.answerSeconds} onChange={e => setOptions({ ...options, answerSeconds: e.target.valueAsNumber })} /></label></div>}
      {selected.length === 0 && <p className="help">{difficultOnly ? '苦手カードはありません。「全部」に切り替えて学習できます。' : '先にカードを追加してください。'}</p>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
      <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>CANCEL</button><button className="button primary" disabled={!selected.length}>START STUDY →</button></div>
    </form>
  </Modal>
}

interface Run { queue: StudyCard[]; shown: boolean; hints: number; paused: boolean; remaining: number; answered: number }
type Action = { type: 'next'; again: boolean; ms: number } | { type: 'reveal'; ms: number } | { type: 'hint' } | { type: 'pause'; value: boolean } | { type: 'tick'; ms: number }
function reducer(state: Run, action: Action): Run {
  switch (action.type) {
    case 'next': return { ...state, queue: action.again ? requeue(state.queue) : state.queue.slice(1), shown: false, hints: 0, remaining: action.ms, answered: state.answered + 1 }
    case 'reveal': return { ...state, shown: true, remaining: action.ms }
    case 'hint': return { ...state, hints: state.hints + 1 }
    case 'pause': return { ...state, paused: action.value }
    case 'tick': return { ...state, remaining: Math.max(0, state.remaining - action.ms) }
  }
}

function KeyboardControls({ auto, revealed, onReveal, onHint, onNext, onAgain, onPause }: { auto: boolean; revealed: boolean; onReveal: () => void; onHint: () => void; onNext: () => void; onAgain: () => void; onPause: () => void }) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      if (target?.closest('button') && (key === ' ' || key === 'enter')) return
      let action: (() => void) | undefined
      if (auto && key === ' ') action = onPause
      else if (!auto && !revealed && key === ' ') action = onReveal
      else if (!auto && !revealed && key === 'h') action = onHint
      else if (!auto && revealed && key === 'enter') action = onNext
      else if (!auto && revealed && key === 'r') action = onAgain
      if (action) { event.preventDefault(); action() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [auto, revealed, onReveal, onHint, onNext, onAgain, onPause])
  return <div className="keyboard-help" aria-label="キーボード操作">{auto ? <span><kbd>SPACE</kbd>PAUSE / RESUME</span> : revealed ? <><span><kbd>ENTER</kbd>NEXT</span><span><kbd>R</kbd>AGAIN</span></> : <><span><kbd>SPACE</kbd>REVEAL</span><span><kbd>H</kbd>HINT +1</span></>}</div>
}

export default function Study({ session, isDifficult, onMark, onExit }: { session: Session; isDifficult: (id: string) => boolean; onMark: (id: string, value: boolean) => boolean; onExit: () => void }) {
  const { settings } = session
  const [state, dispatch] = useReducer(reducer, { queue: session.cards, shown: false, hints: 0, paused: false, remaining: settings.questionSeconds * 1000, answered: 0 })
  const [notice, setNotice] = useState('')
  const current = state.queue[0]
  const auto = settings.mode === 'auto'
  const questionMs = settings.questionSeconds * 1000, answerMs = settings.answerSeconds * 1000
  useEffect(() => {
    if (!auto || state.paused || !current) return
    const timer = setTimeout(() => {
      if (state.remaining > 0) dispatch({ type: 'tick', ms: Math.min(100, state.remaining) })
      else if (!state.shown) dispatch({ type: 'reveal', ms: answerMs })
      else dispatch({ type: 'next', again: false, ms: questionMs })
    }, state.remaining > 0 ? 100 : 0)
    return () => clearTimeout(timer)
  }, [auto, state.paused, state.remaining, state.shown, current, questionMs, answerMs])
  useEffect(() => {
    if (!auto) return
    const hide = () => { if (document.hidden) dispatch({ type: 'pause', value: true }) }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [auto])
  function advance(action: 'next' | 'again' | 'clear') {
    if (!current) return
    if (action !== 'next' && !onMark(current.id, action === 'again')) return
    setNotice(action === 'again' ? `${retryDistance(state.queue.length - 1)}枚を挟んで、もう一度出題します。` : '')
    dispatch({ type: 'next', again: action === 'again', ms: questionMs })
  }
  if (!current) return <main className="finished"><div className="finish-icon">🗿</div><span className="eyebrow">SESSION COMPLETE</span><h1>SESSION COMPLETE.</h1><p>{session.title}の学習が終わりました。</p><div className="finish-stats"><div><strong>{state.answered}</strong><span>回の学習</span></div><div><strong>{session.cards.filter(c => isDifficult(c.id)).length}</strong><span>枚の苦手カード</span></div></div><p className="help">苦手の登録は、解除するまで残っています。</p><button className="button primary" onClick={onExit}>BACK TO DECK →</button></main>
  const question = settings.direction === 'term' ? current.term : current.meaning
  const answer = settings.direction === 'term' ? current.meaning : current.term
  const segments = characters(answer)
  let count = 0
  const hinted = segments.map(char => /\s/u.test(char) ? char : ++count <= state.hints ? char : '＿').join('')
  const revealed = state.shown || state.hints >= segments.filter(c => !/\s/u.test(c)).length
  return <main className="study-page">
    <div className="study-top"><div><span className="eyebrow">{auto ? 'AUTO STUDY' : 'STUDY SESSION'}</span><h1>{session.title}</h1></div><button className="button secondary" onClick={onExit}>EXIT SESSION</button></div>
    <div className="study-meta"><span>{current.deckTitle}</span><span>残り {state.queue.length}枚 {auto && '· 自動送り'}</span></div>
    <section className="flashcard" aria-label="学習カード">
      <div className="question-side"><span className="eyebrow">{settings.direction === 'term' ? 'TERM / QUESTION' : 'MEANING / ANSWER'} {isDifficult(current.id) && <span className="difficult-badge">REVIEW</span>}</span><p className="question-text">{question}</p></div>
      <div className={`answer-side ${revealed || state.hints > 0 ? 'visible' : ''}`}><span className="eyebrow">{settings.direction === 'term' ? 'MEANING / ANSWER' : 'TERM / QUESTION'}</span>{revealed ? <p className="answer-text" aria-live="polite">{answer}</p> : state.hints > 0 ? <p className="answer-text hint-text" aria-live="polite">{hinted}</p> : <p className="answer-placeholder">思い出してから、答えを見てみましょう。</p>}</div>
    </section>
    {auto ? <div className="auto-controls"><span>{state.shown ? '次のカードまで' : '答えの表示まで'} {Math.ceil(state.remaining / 1000)}秒</span><button className="button primary" onClick={() => dispatch({ type: 'pause', value: !state.paused })}>{state.paused ? 'RESUME' : 'PAUSE'}</button><p className="help">苦手の記録は変更しません。全カードを1巡すると終了します。</p></div> : <div className="study-controls">{!revealed ? <><button className="button secondary" onClick={() => dispatch({ type: 'hint' })}>HINT +1</button><button className="button primary" onClick={() => dispatch({ type: 'reveal', ms: answerMs })}>REVEAL</button></> : <><button className="button secondary" onClick={() => advance('again')}>↻ AGAIN</button><button className="button primary" onClick={() => advance('next')}>NEXT →</button>{isDifficult(current.id) && <button className="clear-difficult" onClick={() => advance('clear')}>✓ CLEAR & NEXT</button>}</>}</div>}
    <p className="study-notice" role="status">{notice}</p>
    <KeyboardControls auto={auto} revealed={revealed} onReveal={() => dispatch({ type: 'reveal', ms: answerMs })} onHint={() => dispatch({ type: 'hint' })} onNext={() => advance('next')} onAgain={() => advance('again')} onPause={() => dispatch({ type: 'pause', value: !state.paused })} />
  </main>
}
