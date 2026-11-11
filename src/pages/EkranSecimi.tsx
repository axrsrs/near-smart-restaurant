import { useNavigate } from 'react-router-dom'
import Ikon from '../components/Ikon'
import UstBar from '../components/UstBar'
import { cihazSec, EKRAN_ADI, EKRANLAR, ekranYolu, useCihaz, type Ekran } from '../lib/oturum'

const ACIKLAMA: Record<Ekran, string> = {
  kasa: 'Sipariş al, fiş yazdır',
  mutfak: 'Gelen siparişleri hazırla',
  tv: 'Hazır numaraları göster',
  yonetim: 'Personel, PIN kodları, NearMenu bağlantısı',
}

export default function EkranSecimi() {
  const git = useNavigate()
  const secili = useCihaz()

  return (
    <div className="min-h-dvh bg-ink">
      <UstBar />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Bu cihaz hangi ekran olacak?</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Seçimin bu cihazda hatırlanır. İstediğin zaman buradan değiştirebilirsin.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EKRANLAR.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                cihazSec(e)
                git(ekranYolu(e))
              }}
              className={`group flex min-h-24 items-center gap-4 rounded-2xl border bg-ink-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold ${secili === e ? 'border-gold' : 'border-line'}`}
            >
              <span className="grid size-12 flex-none place-items-center rounded-xl bg-soft text-gold">
                <Ikon ad={e} className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-base font-semibold">
                  {EKRAN_ADI[e]}
                  {secili === e && <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-gold">Bu cihazda seçili</span>}
                </span>
                <span className="block text-[13px] text-muted">{ACIKLAMA[e]}</span>
              </span>
              <Ikon ad="ileri" className="size-4 flex-none text-text/40 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
