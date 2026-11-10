import type { ReactNode } from 'react'

const YOL: Record<string, ReactNode> = {
  eposta: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  kilit: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  goz: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  gozKapali: (<><path d="M2 10s3.5 5 10 5 10-5 10-5" /><path d="m4 13-1.5 2M20 13l1.5 2M9 15l-.8 2.4M15 15l.8 2.4" /></>),
  ok: <path d="M5 12h14M13 6l6 6-6 6" />,
  ileri: <path d="m9 6 6 6-6 6" />,
  geri: <path d="m15 6-6 6 6 6" />,
  gunes: (<><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>),
  ay: <path d="M20.4 14.6A8.5 8.5 0 0 1 9.4 3.6a8.5 8.5 0 1 0 11 11Z" />,
  sil: (<><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" /><path d="m12 9 6 6M18 9l-6 6" /></>),
  cikis: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
  kasa: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M12 16v4M7 9h4M15 9h2M7 12h2" /></>),
  mutfak: <path d="M6 14a4 4 0 0 1 .5-7.9A5 5 0 0 1 16 5a4 4 0 0 1 2 9M6 14v6h12v-6M10 17v3M14 17v3" />,
  tv: (<><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>),
  yonetim: (<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
}

export type IkonAdi = keyof typeof YOL

export default function Ikon({ ad, className = 'size-4' }: { ad: IkonAdi; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {YOL[ad]}
    </svg>
  )
}
