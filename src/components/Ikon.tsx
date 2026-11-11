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
  arti: <path d="M12 5v14M5 12h14" />,
  kalem: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  cop: (<><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></>),
  yukari: <path d="m6 15 6-6 6 6" />,
  asagi: <path d="m6 9 6 6 6-6" />,
  ara: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  kapat: <path d="M6 6l12 12M18 6 6 18" />,
  etiket: (<><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.2" /></>),
  kisiler: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M21.5 20a6.5 6.5 0 0 0-4-6" /></>),
  dukkan: (<><path d="M4 9v11h16V9M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM9 20v-6h6v6" /></>),
  resim: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></>),
  eksi: <path d="M5 12h14" />,
  sepet: (<><path d="M3 4h2.5l2.2 11h10.6L20 7H7" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>),
  liste: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  yazici: (<><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>),
  yasak: (<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>),
  not: (<><path d="M4 5h16v10H9l-5 4Z" /></>),
  yenile: (<><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></>),
  dis: (<><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>),
  ses: (<><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>),
  sessiz: (<><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="m17 9 5 6M22 9l-5 6" /></>),
  tamekran: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  tik: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  zil: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9Z" /><path d="M10 19.5a2 2 0 0 0 4 0" /></>),
  grafik: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  paket: (<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>),
  tablet: (<><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M11 18h2" /></>),
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
