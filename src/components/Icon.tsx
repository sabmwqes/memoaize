import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  flag: <path d="M6 21V3.5M6 4h12l-2.5 4.5L18 13H6" />,
  star: <path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.4 6-5.5-3.2-5.5 3.2 1.4-6-4.6-4.1 6.1-.6z" />,
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  more: <path d="M4.5 12h1M11.5 12h1M18.5 12h1" strokeWidth={3.2} />,
  back: <path d="M20 12H5M11 5.5L4.5 12l6.5 6.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth={3} />,
  skip: <path d="M5.5 5.5v13l9-6.5zM18.5 5v14" />,
  search: <path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20" />,
  import: <path d="M12 3.5v11M7 9.5l5 5 5-5M4 20h16" />,
  export: <path d="M12 14.5v-11M7 8.5l5-5 5 5M4 20h16" />,
  again: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v4.2h4.2" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  edit: <path d="M4 20h4.5L19.5 9 15 4.5 4 15.5zM13 6.5l4.5 4.5" />,
  trash: <path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13" />,
  arrow: <path d="M4 12h15M13 5.5l6.5 6.5-6.5 6.5" />,
}

export type IconName = keyof typeof paths

export default function Icon({ name, filled = false, size = 20 }: { name: IconName; filled?: boolean; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter">{paths[name]}</svg>
}
