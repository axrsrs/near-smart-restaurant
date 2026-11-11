import { useNavigate } from 'react-router-dom'
import { cikis, useYonetici } from '../lib/oturum'
import Ikon from './Ikon'
import TemaDugmesi from './TemaDugmesi'

/** Yönetici ekranlarının üst barı: seçili işletmenin logosu (yoksa baş harfleri) ve adı. */
export default function UstBar() {
  const y = useYonetici()
  const git = useNavigate()
  if (y.durum !== 'var') return null
  const ad = y.secili?.ad ?? 'Tetra'
  const logo = y.secili?.logo
  const harfler = ad
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k.charAt(0).toLocaleUpperCase('tr'))
    .join('')

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        {logo ? (
          <img src={logo} alt="" className="h-9 w-auto max-w-32 flex-none object-contain" />
        ) : (
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-text text-sm font-bold text-ink">{harfler}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{ad}</p>
          <p className="truncate text-xs text-muted">{y.eposta}</p>
        </div>
        <TemaDugmesi />
        <button
          type="button"
          aria-label="Çıkış yap"
          title="Çıkış yap"
          onClick={async () => {
            await cikis()
            git('/giris', { replace: true })
          }}
          className="grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-text transition-transform hover:scale-105 active:scale-95"
        >
          <Ikon ad="cikis" className="size-5" />
        </button>
      </div>
    </header>
  )
}
