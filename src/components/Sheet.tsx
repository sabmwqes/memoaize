import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Icon from './Icon.tsx'

/** スマホでは下から出るシート、PC では中央のダイアログ。 */
export default function Sheet({ title, onClose, children, footer, accent = 'var(--cyan)' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; accent?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current!
    if (!dialog.open) dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className="sheet" aria-labelledby={id} style={{ '--sheet-accent': accent } as CSSProperties}
    onCancel={e => { e.preventDefault(); onClose() }}
    onClick={e => { if (e.target === ref.current) onClose() }}>
    <div className="sheet-inner">
      <header className="sheet-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button>
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <footer className="sheet-foot">{footer}</footer>}
    </div>
  </dialog>
}
