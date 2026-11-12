import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Ikon, { type IkonAdi } from '../components/Ikon'
import UstBar from '../components/UstBar'
import { useYonetici } from '../lib/oturum'

const SEKMELER: { yol: string; ad: string; ikon: IkonAdi }[] = [
  { yol: 'personel', ad: 'Personel', ikon: 'kisiler' },
  { yol: 'cihazlar', ad: 'Cihazlar', ikon: 'tablet' },
  { yol: 'menu', ad: 'Menü', ikon: 'etiket' },
  { yol: 'raporlar', ad: 'Raporlar', ikon: 'grafik' },
  { yol: 'isletme', ad: 'İşletme', ikon: 'dukkan' },
]

export default function Yonetim() {
  const git = useNavigate()
  const y = useYonetici()
  if (y.durum !== 'var') return null
  if (!y.secili) return <Navigate to="/ekran" replace />

  return (
    <div className="min-h-dvh bg-ink">
      <UstBar />
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => git('/ekran')} className="mb-3 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm text-muted hover:text-text">
          <Ikon ad="geri" className="size-4" />
          Ekran seçimi
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Yönetim</h1>
        <nav aria-label="Yönetim bölümleri" className="mt-4 mb-6 grid grid-cols-3 gap-1 sm:grid-cols-5 rounded-xl border border-line bg-ink-2 p-1">
          {SEKMELER.map((s) => (
            <NavLink
              key={s.yol}
              to={s.yol}
              replace
              className={({ isActive }) =>
                `flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition ${isActive ? 'bg-text text-ink' : 'text-muted hover:text-text'}`
              }
            >
              <Ikon ad={s.ikon} className="size-[18px] flex-none" />
              <span className="truncate">{s.ad}</span>
            </NavLink>
          ))}
        </nav>
        <Outlet context={y.secili} />
      </div>
    </div>
  )
}
