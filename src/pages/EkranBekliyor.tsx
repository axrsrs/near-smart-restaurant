import { Navigate, useNavigate } from 'react-router-dom'
import Ikon from '../components/Ikon'
import UstBar from '../components/UstBar'
import { EKRAN_ADI, PIN_ISTEYEN, personelCikis, usePersonel, type Ekran } from '../lib/oturum'

const ASAMA: Record<Exclude<Ekran, 'yonetim'>, string> = {
  kasa: 'Kasa ekranı 3. aşamada kurulacak.',
  mutfak: 'Mutfak ekranı 4. aşamada kurulacak.',
  tv: 'TV ekranı 5. aşamada kurulacak.',
}

/** Sıradaki aşamalarda kurulacak ekranların giriş noktası. Her ekran kendi aşamasında bu sayfanın yerini alır. */
export default function EkranBekliyor({ ekran }: { ekran: Exclude<Ekran, 'yonetim'> }) {
  const personel = usePersonel()
  const git = useNavigate()
  const pinli = PIN_ISTEYEN.includes(ekran)

  if (pinli && personel?.ekran !== ekran) return <Navigate to={`/pin/${ekran}`} replace />

  return (
    <div className="min-h-dvh bg-ink">
      <UstBar />
      <main className="mx-auto max-w-xl px-4 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="rounded-2xl border border-line bg-ink-2 p-6">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
            <Ikon ad={ekran} className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{EKRAN_ADI[ekran]}</h1>
          <p className="mt-1 text-sm text-muted">{ASAMA[ekran]}</p>
          {pinli && personel && <p className="mt-3 text-sm">Giriş yapan: <b className="font-semibold">{personel.ad}</b></p>}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={() => git('/ekran')} className="h-12 flex-1 rounded-[10px] bg-gold px-4 text-[15px] font-semibold text-on-gold transition hover:bg-gold-dark">
              Ekran seçimine dön
            </button>
            {pinli && (
              <button
                type="button"
                onClick={() => {
                  personelCikis()
                  git(`/pin/${ekran}`, { replace: true })
                }}
                className="h-12 flex-1 rounded-[10px] border border-line bg-ink px-4 text-[15px] font-semibold transition hover:border-text/40"
              >
                Personeli değiştir
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
