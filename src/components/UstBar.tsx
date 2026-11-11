import { useNavigate } from 'react-router-dom'
import { cikis, useOturum } from '../lib/oturum'
import { useIsletme } from '../lib/isletme'
import Ikon from './Ikon'
import OnizlemeEtiketi from './OnizlemeEtiketi'
import TemaDugmesi from './TemaDugmesi'

/** Giriş sonrası üst bar: işletmenin logosu (yoksa baş harfleri), adı ve şubesi. */
export default function UstBar() {
  const oturum = useOturum()
  const { ad, logo } = useIsletme()
  const git = useNavigate()
  if (!oturum) return null
  const harfler = ad
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k.charAt(0).toLocaleUpperCase('tr'))
    .join('')

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        {logo ? (
          <img src={logo} alt={ad} className="h-9 w-auto max-w-32 flex-none object-contain" />
        ) : (
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-text text-sm font-bold text-ink">{harfler}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{ad}</p>
          <p className="truncate text-xs text-muted">Tetra</p>
        </div>
        <OnizlemeEtiketi className="hidden sm:inline-flex" />
        <TemaDugmesi />
        <button
          type="button"
          aria-label="Çıkış yap"
          title="Çıkış yap"
          onClick={() => {
            cikis()
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
