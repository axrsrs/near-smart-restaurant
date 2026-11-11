import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import TemaDugmesi from '../components/TemaDugmesi'
import { takipOku, type SiparisDurumu, type Takip as TakipVerisi } from '../lib/veri'

const ADIMLAR: { durum: SiparisDurumu; ad: string }[] = [
  { durum: 'hazirlaniyor', ad: 'Hazırlanıyor' },
  { durum: 'hazir', ad: 'Hazır' },
  { durum: 'teslim', ad: 'Teslim edildi' },
]
const ARALIK = 15_000

/** Müşterinin QR ile açtığı sipariş takip sayfası. Sürekli bağlantı tutmaz: sayfa açıkken 15 saniyede bir durumu sorar. */
export default function Takip() {
  const { kod = '' } = useParams()
  const [veri, setVeri] = useState<TakipVerisi | null | undefined>(undefined) // undefined: yükleniyor, null: bulunamadı
  const [hata, setHata] = useState(false)
  const bitti = veri?.durum === 'teslim' || veri?.durum === 'iptal' || veri === null

  useEffect(() => {
    if (bitti) return
    let iptal = false
    const sor = () => {
      if (document.hidden) return
      takipOku(kod)
        .then((v) => {
          if (iptal) return
          setVeri(v)
          setHata(false)
        })
        .catch(() => !iptal && setHata(true))
    }
    sor()
    const sayac = setInterval(sor, ARALIK)
    document.addEventListener('visibilitychange', sor)
    return () => {
      iptal = true
      clearInterval(sayac)
      document.removeEventListener('visibilitychange', sor)
    }
  }, [kod, bitti])

  const sira = veri ? ADIMLAR.findIndex((a) => a.durum === veri.durum) : -1

  return (
    <div className="flex min-h-dvh flex-col items-center bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md justify-end">
        <TemaDugmesi />
      </div>
      <main className="mt-4 w-full max-w-md rounded-2xl border border-line bg-ink-2 p-6 text-center">
        {veri?.isletme.logo ? <img src={veri.isletme.logo} alt={veri.isletme.ad} className="mx-auto mb-4 h-12 w-auto max-w-40 object-contain" /> : veri ? <p className="mb-4 text-base font-semibold">{veri.isletme.ad}</p> : null}
        {veri === undefined ? (
          <p className="py-10 text-sm text-muted">{hata ? 'Bağlantı kurulamadı. Yeniden deneniyor…' : 'Sipariş aranıyor…'}</p>
        ) : veri === null ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Sipariş bulunamadı</h1>
            <p className="mt-2 text-sm text-muted">Bu takip adresi geçersiz ya da siparişin üzerinden bir günden fazla geçmiş.</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Sipariş no</p>
            <h1 className="text-8xl leading-none font-bold tracking-tight tabular-nums">{veri.no}</h1>
            {veri.durum === 'iptal' ? (
              <p className="mt-5 rounded-xl border border-danger/50 px-4 py-3 text-base font-semibold text-danger">Bu sipariş iptal edildi.</p>
            ) : (
              <ol className="mt-6 flex flex-col gap-2 text-left">
                {ADIMLAR.map((a, i) => (
                  <li key={a.durum} aria-current={i === sira ? 'step' : undefined} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-semibold ${i === sira ? (a.durum === 'hazirlaniyor' ? 'border-warn bg-ink-2 text-warn' : 'border-ok bg-ok/10 text-ok') : 'border-line text-muted'}`}>
                    <span className={`size-2.5 flex-none rounded-full ${i <= sira ? 'bg-current' : 'border border-current'}`} />
                    {a.ad}
                  </li>
                ))}
              </ol>
            )}
            {!bitti && <p className="mt-4 text-xs text-muted">{hata ? 'Bağlantı kurulamadı; yeniden deneniyor.' : 'Bu sayfa açıkken durum kendiliğinden güncellenir.'}</p>}
          </>
        )}
      </main>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Tetra · NEAR</p>
    </div>
  )
}
