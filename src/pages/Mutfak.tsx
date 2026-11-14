import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BTN_IKINCIL } from '../components/bicim'
import Ikon from '../components/Ikon'
import TemaDugmesi from '../components/TemaDugmesi'
import { useCanli, useTazele } from '../lib/canli'
import { TUR_ADI } from '../lib/etiketler'
import { kilitle, type Isletme } from '../lib/oturum'
import { cal, sesHazirla, sesiDene, useSesAcik } from '../lib/ses'
import { siparisDurumu, siparisleriYukle, useSiparisler, type Siparis, type SiparisDurumu } from '../lib/veri'

const dakika = (z: number, simdi: number) => Math.max(0, Math.floor((simdi - z) / 60_000))

/** Mutfak ekranı: kasadan gelen siparişler anında düşer; personel "Hazır" ve "Teslim edildi" ile ilerletir. */
export default function Mutfak({ isletme, personel, kanal }: { isletme: Isletme; personel: { id: string; ad: string }; kanal: string }) {
  const git = useNavigate()
  const siparisler = useSiparisler()
  const sesAcik = useSesAcik()
  const [hata, setHata] = useState('')
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [simdi, setSimdi] = useState(() => Date.now())
  const [yeniler, setYeniler] = useState<Set<string>>(new Set())
  const bilinen = useRef<Set<string> | null>(null)

  const yukle = () => void siparisleriYukle().then((s) => setHata(s.tamam ? '' : s.hata))
  const bagli = useCanli(kanal, (konu) => konu === 'siparis' && yukle())
  useTazele(yukle, bagli)

  useEffect(() => sesHazirla('yeni'), [])

  useEffect(() => {
    const sayac = setInterval(() => setSimdi(Date.now()), 20_000)
    return () => clearInterval(sayac)
  }, [])

  /* ilk yüklemeden sonra listeye yeni giren sipariş: ses ve kısa süreli çerçeve */
  useEffect(() => {
    const idler = new Set(siparisler.filter((s) => s.durum === 'hazirlaniyor').map((s) => s.id))
    if (bilinen.current) {
      const eski = bilinen.current
      const gelen = [...idler].filter((id) => !eski.has(id))
      if (gelen.length) {
        cal('yeni')
        setYeniler((y) => new Set([...y, ...gelen]))
        setTimeout(() => setYeniler((y) => new Set([...y].filter((id) => !gelen.includes(id)))), 4000)
      }
    }
    bilinen.current = new Set(siparisler.map((s) => s.id))
  }, [siparisler])

  const hazirlanan = useMemo(() => siparisler.filter((s) => s.durum === 'hazirlaniyor').sort((a, b) => a.zaman - b.zaman), [siparisler])
  const hazir = useMemo(() => siparisler.filter((s) => s.durum === 'hazir').sort((a, b) => a.zaman - b.zaman), [siparisler])

  const ilerlet = async (s: Siparis, durum: SiparisDurumu) => {
    if (mesgul) return
    setMesgul(s.id)
    const y = await siparisDurumu(s.id, durum)
    setMesgul(null)
    setHata(y.tamam ? '' : y.hata)
  }

  return (
    <div data-cam="mat" className="flex h-dvh flex-col bg-ink">
      <header className="flex-none border-b border-line bg-glass pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {isletme.logo ? (
            <img src={isletme.logo} alt="" className="h-9 w-auto max-w-24 flex-none object-contain" />
          ) : (
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-text text-sm font-bold text-ink">{isletme.ad.charAt(0)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">{isletme.ad}</p>
            <p className="truncate text-xs text-muted">Mutfak · {personel.ad}</p>
          </div>
          <span title={bagli ? 'Siparişler anında düşer' : 'Canlı bağlantı yok; 15 saniyede bir denetleniyor'} className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${bagli ? 'border-ok/50 text-ok' : 'border-warn/50 text-warn'}`}>
            <span className="size-1.5 rounded-full bg-current" />
            {bagli ? 'Canlı' : 'Bağlanıyor'}
          </span>
          <button type="button" onClick={() => void sesiDene('yeni')} title={sesAcik ? 'Ses açık: denemek için dokunun' : 'Sesi açmak için dokunun'} aria-label={sesAcik ? 'Ses açık, sesi dene' : 'Ses kapalı, sesi aç'} className={`grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 transition active:scale-95 ${sesAcik ? 'text-text' : 'text-warn'}`}>
            <Ikon ad={sesAcik ? 'ses' : 'sessiz'} className="size-5" />
          </button>
          <TemaDugmesi />
          <button type="button" onClick={() => void kilitle()} title="Ekranı kilitle" aria-label="Ekranı kilitle" className="grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-text">
            <Ikon ad="kilit" className="size-5" />
          </button>
        </div>
      </header>

      {hata && <p role="alert" className="flex-none border-b border-line px-4 py-2 text-[13px] text-danger">{hata}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[2fr_1fr] lg:overflow-hidden">
        <section aria-label="Hazırlanıyor" className="cam-p bg-ink p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto">
          <h2 className="mb-3 flex items-baseline gap-2 text-[13px] font-semibold tracking-wider text-muted uppercase">
            Hazırlanıyor <span className="font-normal tabular-nums">{hazirlanan.length}</span>
          </h2>
          {!hazirlanan.length ? (
            <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-line text-center text-sm text-muted">
              <div>
                <Ikon ad="mutfak" className="mx-auto mb-2 size-8 opacity-40" />
                Bekleyen sipariş yok
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {hazirlanan.map((s) => {
                const dk = dakika(s.zaman, simdi)
                return (
                  <li key={s.id} className={`flex flex-col rounded-2xl border bg-ink-2 p-4 ${yeniler.has(s.id) ? 'yeni-siparis border-gold' : 'border-line'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-5xl leading-none font-bold tracking-tight tabular-nums">{s.no}</span>
                      {s.tur === 'paket' && <span className="rounded-lg bg-text px-2.5 py-1 text-sm font-bold tracking-wide text-ink">PAKET</span>}
                      <span className={`ml-auto text-sm font-semibold tabular-nums ${dk >= 15 ? 'text-danger' : dk >= 8 ? 'text-warn' : 'text-muted'}`}>{dk} dk</span>
                    </div>
                    <ul className="my-3 flex flex-1 flex-col gap-1.5 border-y border-line py-3">
                      {s.kalemler.map((k, i) => (
                        <li key={i} className="text-base leading-snug">
                          <b className="font-semibold tabular-nums">{k.adet} ×</b> {k.ad}
                          {k.not && <span className="block pl-7 text-[15px] font-semibold text-warn">{k.not}</span>}
                        </li>
                      ))}
                    </ul>
                    <button type="button" disabled={mesgul !== null} onClick={() => void ilerlet(s, 'hazir')} aria-label={`${s.no} numaralı sipariş hazır`} className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-ok text-lg font-bold text-on-ok transition active:scale-[0.98] disabled:opacity-60">
                      <Ikon ad="tik" className="size-5" />
                      Hazır
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-label="Hazır, teslim bekliyor" className="border-t border-line bg-ink-2 p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <h2 className="mb-3 flex items-baseline gap-2 text-[13px] font-semibold tracking-wider text-muted uppercase">
            Hazır · teslim bekliyor <span className="font-normal tabular-nums">{hazir.length}</span>
          </h2>
          {!hazir.length ? (
            <p className="py-8 text-center text-sm text-muted">Teslim bekleyen sipariş yok</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {hazir.map((s) => (
                <li key={s.id} className="rounded-2xl border border-ok/50 bg-ink p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-4xl leading-none font-bold tracking-tight text-ok tabular-nums">{s.no}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">
                      {TUR_ADI[s.tur]} · {s.kalemler.reduce((t, k) => t + k.adet, 0)} ürün
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
                    <button type="button" disabled={mesgul !== null} onClick={() => void ilerlet(s, 'teslim')} aria-label={`${s.no} numaralı sipariş teslim edildi`} className="h-12 rounded-[10px] bg-gold px-3 text-[15px] font-semibold text-on-gold transition active:scale-[0.98] disabled:opacity-60">
                      Teslim edildi
                    </button>
                    <button type="button" disabled={mesgul !== null} onClick={() => void ilerlet(s, 'hazirlaniyor')} aria-label={`${s.no} numaralı siparişi hazırlanıyora geri al`} className={`${BTN_IKINCIL} h-12 px-3`}>
                      Geri al
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => git('/giris')} className="mt-6 min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text">
            Yönetici girişi
          </button>
        </section>
      </div>
    </div>
  )
}
