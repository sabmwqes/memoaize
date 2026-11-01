import type { ReactNode } from 'react'

export interface Option<T extends string> { value: T; label: ReactNode; disabled?: boolean }

export default function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return <div className="segmented" role="group" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" aria-pressed={value === o.value} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>
}
