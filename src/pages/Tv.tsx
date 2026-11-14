import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Ikon from '../components/Ikon'
import TemaDugmesi from '../components/TemaDugmesi'
import { useCanli, useTazele } from '../lib/canli'
import type { Isletme } from '../lib/oturum'
import { cal, sesHazirla, useSesAcik } from '../lib/ses'
import { hataMetni } from '../lib/sunucu'
import { tvListesi, type TvSiparis } from '../lib/veri'

const YENI_SURESI = 20_000
const SAYI = 'leading-none font-bold tracking-tight tabular-nums'

/** Müşteriye dönük TV ekranı: hazırlanan ve hazır sipariş numaraları. Yalnızca numara gösterir; dokunmadan çalışır. */
export default function Tv({ isletme, kanal }: { isletme: Isletme; kanal: string }) {
  const git = useNavigate()
  const sesAcik = useSesAcik()
  const [liste, setListe] = useState<TvSiparis[] | null>(null)
  const [hata, setHata] = useState('')
  const [simdi, setSimdi] = useState(() => Date.now())
  const bilinen = useRef<Set<number> | null>(null)

  const yukle = () =>
    void tvListesi().then(
      (l) => {
        setListe(l)
        setHata('')
      },
      (e) => setHata(hataMetni(e)),
    )
  const bagli = useCanli(kanal, (konu) => konu === 'siparis' && yukle())
  useTazele(yukle, bagli)

  useEffect(() => sesHazirla('hazirTv'), [])

  useEffect(() => {
    const sayac = setInterval(() => setSimdi(Date.now()), 5000)
    return () => clearInterval(sayac)
  }, [])

  /* ekran kararmasın (tarayıcı destekliyorsa) */
  useEffect(() => {
    let kilit: { release: () => Promise<void> } | null = null
    const al = () => {
      if (document.hidden) return
      const w = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      w?.request('screen').then(
        (k) => (kilit = k),
        () => {},
      )
    }
    al()
    document.addEventListener('visibilitychange', al)
    return () => {
      document.removeEventListener('visibilitychange', al)
      void kilit?.release().catch(() => {})
    }
  }, [])

  const hazirlanan = useMemo(() => (liste ?? []).filter((s) => s.durum === 'hazirlaniyor').sort((a, b) => a.no - b.no), [liste])
  const hazir = useMemo(() => (liste ?? []).filter((s) => s.durum === 'hazir').sort((a, b) => (b.hazirZaman ?? 0) - (a.hazirZaman ?? 0)), [liste])

  /* yeni hazır olan numara: ses */
  useEffect(() => {
    if (!liste) return
    const nolar = new Set(hazir.map((s) => s.no))
    if (bilinen.current && [...nolar].some((n) => !bilinen.current!.has(n))) cal('hazirTv')
    bilinen.current = nolar
  }, [liste, hazir])

  const tamEkran = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div data-cam="mat" className="flex h-dvh flex-col bg-ink">
      <header className="flex flex-none items-center gap-3 border-b border-line px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <div className="flex h-16 min-w-0 flex-1 items-center gap-3">
          {isletme.logo && <img src={isletme.logo} alt="" className="h-10 w-auto max-w-32 flex-none object-contain" />}
          <p className="truncate text-xl font-semibold tracking-tight">{isletme.ad}</p>
        </div>
        <p className="hidden text-2xl font-semibold tabular-nums sm:block" aria-hidden="true">
          {new Date(simdi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <span title={sesAcik ? 'Sipariş hazır olunca ses çalar' : 'Ses için ekrana bir kez dokunun'} aria-label={sesAcik ? 'Ses açık' : 'Ses kapalı: açmak için ekrana dokunun'} className={`grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 ${sesAcik ? 'text-muted' : 'text-warn'}`}>
          <Ikon ad={sesAcik ? 'ses' : 'sessiz'} className="size-5" />
        </span>
        <button type="button" onClick={tamEkran} title="Tam ekran" aria-label="Tam ekran" className="grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-muted">
          <Ikon ad="tamekran" className="size-5" />
        </button>
        <TemaDugmesi />
        <button type="button" onClick={() => git('/giris')} title="Yönetici girişi" aria-label="Yönetici girişi" className="grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-muted">
          <Ikon ad="yonetim" className="size-5" />
        </button>
      </header>

      {!sesAcik && <p className="flex-none border-b border-line px-4 py-1.5 text-center text-[13px] text-warn">Sesli uyarı için ekrana bir kez dokunun.</p>}
      {hata && <p role="alert" className="flex-none border-b border-line px-4 py-1.5 text-center text-[13px] text-danger">{hata}</p>}

      <main className="cam-p grid min-h-0 flex-1 grid-rows-2 bg-ink md:grid-cols-2 md:grid-rows-1">
        <section aria-label="Hazırlanıyor" className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-6">
          <h2 className="mb-3 flex-none text-[clamp(1rem,2.4vw,1.75rem)] font-semibold tracking-wide text-muted uppercase">Hazırlanıyor</h2>
          <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-2 overflow-hidden">
            {hazirlanan.map((s) => (
              <li key={s.no} className={`${SAYI} text-[clamp(2.25rem,6vw,5rem)] text-text/70`}>{s.no}</li>
            ))}
            {liste && !hazirlanan.length && <li className="text-base text-muted">Bekleyen sipariş yok</li>}
          </ul>
        </section>
        <section aria-label="Hazır" aria-live="polite" className="flex min-h-0 flex-col overflow-hidden border-t border-line bg-ok/10 p-4 sm:p-6 md:border-t-0 md:border-l">
          <h2 className="mb-3 flex-none text-[clamp(1rem,2.4vw,1.75rem)] font-semibold tracking-wide text-ok uppercase">Hazır · teslim alabilirsiniz</h2>
          <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-x-[clamp(1.25rem,4vw,3.5rem)] gap-y-3 overflow-hidden">
            {hazir.map((s) => (
              <li key={s.no} className={`${SAYI} origin-left text-[clamp(3.5rem,10vw,9rem)] text-ok ${s.hazirZaman && simdi - s.hazirZaman < YENI_SURESI ? 'yeni-hazir' : ''}`}>
                {s.no}
              </li>
            ))}
            {liste && !hazir.length && <li className="text-base text-muted">Henüz hazır sipariş yok</li>}
          </ul>
        </section>
      </main>
      <p className="flex-none pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Tetra · NEAR{bagli ? '' : ' · bağlanıyor'}</p>
    </div>
  )
}
