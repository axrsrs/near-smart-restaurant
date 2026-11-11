import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Ikon from '../components/Ikon'
import TemaDugmesi from '../components/TemaDugmesi'
import { bildirimAc, bildirimDestegi } from '../lib/bildirim'
import { useCanli } from '../lib/canli'
import { cal } from '../lib/ses'
import { takipOku, type SiparisDurumu, type Takip as TakipVerisi } from '../lib/veri'

const ADIMLAR: { durum: SiparisDurumu; ad: string }[] = [
  { durum: 'hazirlaniyor', ad: 'Hazırlanıyor' },
  { durum: 'hazir', ad: 'Hazır' },
  { durum: 'teslim', ad: 'Teslim edildi' },
]

/** Müşterinin QR ile açtığı takip sayfası. Durum değişince anında güncellenir; istenirse telefona bildirim gönderilir. */
export default function Takip() {
  const { kod = '' } = useParams()
  const [veri, setVeri] = useState<TakipVerisi | null | undefined>(undefined) // undefined: yükleniyor, null: bulunamadı
  const [hata, setHata] = useState(false)
  const [haber, setHaber] = useState<'kapali' | 'bekliyor' | 'bildirim' | 'ses'>('kapali')
  const [haberNotu, setHaberNotu] = useState('')
  const onceki = useRef<SiparisDurumu | null>(null)
  const bitti = veri?.durum === 'teslim' || veri?.durum === 'iptal' || veri === null
  const gecerli = /^[0-9a-f]{32}$/.test(kod)

  const sor = () => {
    if (!gecerli) return setVeri(null)
    takipOku(kod).then(
      (v) => {
        setVeri(v)
        setHata(false)
      },
      () => setHata(true),
    )
  }
  /* sipariş durumu değişince sunucu bu siparişin kanalına haber yollar; bağlantı yoksa 5 saniyede bir sorulur */
  const bagli = useCanli(gecerli && !bitti ? kod : '', sor, 'tetra-takip')
  const sorRef = useRef(sor)
  useEffect(() => {
    sorRef.current = sor
  })
  useEffect(() => {
    if (bitti) return
    const calis = () => {
      if (!document.hidden) sorRef.current()
    }
    calis()
    const sayac = setInterval(calis, bagli ? 30_000 : 5000)
    document.addEventListener('visibilitychange', calis)
    return () => {
      clearInterval(sayac)
      document.removeEventListener('visibilitychange', calis)
    }
  }, [bitti, bagli, kod])

  /* hazır olduğu an: ses ve titreşim (sayfa açıksa) */
  useEffect(() => {
    const d = veri?.durum ?? null
    if (d === 'hazir' && onceki.current === 'hazirlaniyor') {
      cal('hazir')
      try {
        navigator.vibrate?.([300, 150, 300, 150, 600])
      } catch {
        /* titreşim desteklenmiyor */
      }
    }
    onceki.current = d
  }, [veri?.durum])

  const haberVer = async () => {
    setHaber('bekliyor')
    /* dokunuş sesi açar (lib/ses); bildirim izni ayrıca sorulur */
    const s = await bildirimAc(kod)
    setHaber(s.tamam ? 'bildirim' : 'ses')
    setHaberNotu(s.tamam ? '' : s.hata)
  }

  const sira = veri ? ADIMLAR.findIndex((a) => a.durum === veri.durum) : -1
  const hazir = veri?.durum === 'hazir'

  return (
    <div className={`flex min-h-dvh flex-col items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] transition-colors ${hazir ? 'bg-ok/15' : 'bg-ink'}`}>
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
            <h1 className={`text-8xl leading-none font-bold tracking-tight tabular-nums ${hazir ? 'yeni-hazir text-ok' : ''}`}>{veri.no}</h1>
            {hazir && <p className="mt-3 text-xl font-semibold text-ok" role="status">Siparişiniz hazır, teslim alabilirsiniz.</p>}
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

            {veri.durum === 'hazirlaniyor' &&
              (haber === 'kapali' || haber === 'bekliyor' ? (
                <button type="button" disabled={haber === 'bekliyor'} onClick={() => void haberVer()} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-gold px-4 text-base font-semibold text-on-gold transition active:scale-[0.98] disabled:opacity-70">
                  <Ikon ad="zil" className="size-5" />
                  {haber === 'bekliyor' ? 'İzin bekleniyor…' : 'Hazır olunca haber ver'}
                </button>
              ) : (
                <p role="status" className={`mt-5 rounded-[10px] border px-4 py-3 text-sm ${haber === 'bildirim' ? 'border-ok/50 text-ok' : 'border-warn/50 text-warn'}`}>
                  {haber === 'bildirim' ? 'Bildirim açık. Bu sayfayı kapatsan bile siparişin hazır olunca telefonuna haber gelir.' : haberNotu}
                </p>
              ))}
            {veri.durum === 'hazirlaniyor' && haber === 'kapali' && bildirimDestegi() === 'yok' && <p className="mt-2 text-xs text-muted">Bu tarayıcıda bildirim yok; düğmeye basarsan sayfa açıkken sesli uyarı verilir.</p>}
            {!bitti && <p className="mt-4 text-xs text-muted">{hata ? 'Bağlantı kurulamadı; yeniden deneniyor.' : 'Durum değişince bu sayfa kendiliğinden güncellenir.'}</p>}
          </>
        )}
      </main>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Tetra · NEAR</p>
    </div>
  )
}
