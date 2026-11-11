import { useParams } from 'react-router-dom'
import TemaDugmesi from '../components/TemaDugmesi'
import { useIsletme } from '../lib/isletme'
import { useSiparisler, type SiparisDurumu } from '../lib/veri'

const ADIMLAR: { durum: SiparisDurumu; ad: string }[] = [
  { durum: 'hazirlaniyor', ad: 'Hazırlanıyor' },
  { durum: 'hazir', ad: 'Hazır' },
  { durum: 'teslim', ad: 'Teslim edildi' },
]

/** Müşterinin QR ile açtığı sipariş takip sayfası. Önizlemede yalnızca siparişin alındığı cihazda çalışır. */
export default function Takip() {
  const { kod } = useParams()
  const { ad, logo } = useIsletme()
  const siparis = useSiparisler().find((s) => s.kod === kod)
  const sira = siparis ? ADIMLAR.findIndex((a) => a.durum === siparis.durum) : -1

  return (
    <div className="flex min-h-dvh flex-col items-center bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md justify-end">
        <TemaDugmesi />
      </div>
      <main className="mt-4 w-full max-w-md rounded-2xl border border-line bg-ink-2 p-6 text-center">
        {logo ? <img src={logo} alt={ad} className="mx-auto mb-4 h-12 w-auto max-w-40 object-contain" /> : <p className="mb-4 text-base font-semibold">{ad}</p>}
        {!siparis ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Sipariş bulunamadı</h1>
            <p className="mt-2 text-sm text-muted">Sipariş takibi şu an yalnızca siparişin alındığı cihazda açılır. Sunucu bağlandığında bu sayfa her telefonda çalışacak ve sipariş hazır olunca bildirim gönderecek.</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Sipariş no</p>
            <h1 className="text-8xl leading-none font-bold tracking-tight tabular-nums">{siparis.no}</h1>
            {siparis.durum === 'iptal' ? (
              <p className="mt-5 rounded-xl bg-danger/10 px-4 py-3 text-base font-semibold text-danger">Bu sipariş iptal edildi.</p>
            ) : (
              <ol className="mt-6 flex flex-col gap-2 text-left">
                {ADIMLAR.map((a, i) => (
                  <li key={a.durum} aria-current={i === sira ? 'step' : undefined} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-semibold ${i === sira ? (a.durum === 'hazirlaniyor' ? 'border-warn bg-warn/10 text-warn' : 'border-ok bg-ok/10 text-ok') : i < sira ? 'border-line text-muted' : 'border-line text-text/35'}`}>
                    <span className={`size-2.5 flex-none rounded-full ${i <= sira ? 'bg-current' : 'border border-current'}`} />
                    {a.ad}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </main>
    </div>
  )
}
