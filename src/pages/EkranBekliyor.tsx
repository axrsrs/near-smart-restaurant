import { useNavigate } from 'react-router-dom'
import Ikon from '../components/Ikon'
import TemaDugmesi from '../components/TemaDugmesi'
import { EKRAN_ADI, kilitle, type Isletme } from '../lib/oturum'

/** Mutfak ve TV ekranlarının giriş noktası. Ekranların kendisi bir sonraki adımda bu sayfanın yerini alır. */
export default function EkranBekliyor({ ekran, isletme, personel }: { ekran: 'mutfak' | 'tv'; isletme: Isletme; personel: { ad: string } | null }) {
  const git = useNavigate()
  return (
    <div className="min-h-dvh bg-ink">
      <header className="border-b border-line bg-glass pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          {isletme.logo ? <img src={isletme.logo} alt="" className="h-9 w-auto max-w-32 flex-none object-contain" /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">{isletme.ad}</p>
            <p className="truncate text-xs text-muted">{EKRAN_ADI[ekran]}{personel ? ` · ${personel.ad}` : ''}</p>
          </div>
          <TemaDugmesi />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="rounded-2xl border border-line bg-ink-2 p-6">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
            <Ikon ad={ekran} className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{EKRAN_ADI[ekran]}</h1>
          <p className="mt-1 text-sm text-muted">Bu cihaz {EKRAN_ADI[ekran]} olarak tanıtıldı. Ekranın kendisi bir sonraki adımda kurulacak; kasadan alınan siparişler şimdiden sunucuya kaydediliyor.</p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {personel && (
              <button type="button" onClick={() => void kilitle()} className="h-12 flex-1 rounded-[10px] border border-line bg-ink px-4 text-[15px] font-semibold transition hover:border-text/40">
                Ekranı kilitle
              </button>
            )}
            <button type="button" onClick={() => git('/giris')} className="h-12 flex-1 rounded-[10px] border border-line bg-ink px-4 text-[15px] font-semibold transition hover:border-text/40">
              Yönetici girişi
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
