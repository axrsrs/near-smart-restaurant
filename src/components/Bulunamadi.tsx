import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo-near-ana.png'
import AkanCizgiler from './AkanCizgiler'
import Ikon, { type IkonAdi } from './Ikon'
import TemaDugmesi from './TemaDugmesi'

/** 404 düğmesi: ya bir adrese gider ya da bir iş yapar (ör. yeniden dene). */
export type BulunamadiDugme = { ikon: IkonAdi; etiket: string; adres?: string; tikla?: () => void }

const DUGME =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2'
const ANA = `${DUGME} bg-text text-ink hover:bg-text/90`
const IKINCIL = `${DUGME} border border-line bg-ink/70 text-text backdrop-blur-sm hover:bg-ink-3`

/**
 * neardiji.com ile aynı 404 ekranı: büyük, aşağı doğru silinen 404, açıklama, iki düğme; arka planda akan çizgiler.
 * NEAR Mono renklerini kullanır ([data-near]); açık/koyu temaya uyar.
 */
export default function Bulunamadi({ aciklama, dugmeler }: { aciklama: ReactNode; dugmeler: BulunamadiDugme[] }) {
  return (
    <div
      data-near
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-4 pt-[max(6rem,env(safe-area-inset-top))] pb-[max(4rem,env(safe-area-inset-bottom))] text-text"
    >
      <div className="absolute inset-0 opacity-50 [contain:strict] dark-cizgi">
        <AkanCizgiler />
      </div>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 left-4 z-10 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Tetra ana sayfa" className="block leading-none">
          <img src={logo} alt="NEAR Agency" width={131} height={34} className="near-logo h-7 w-auto sm:h-[34px]" />
          <span className="mt-1.5 block text-[10px] font-semibold tracking-[0.3em] text-gold">TETRA</span>
        </Link>
        <TemaDugmesi />
      </div>

      <main className="relative z-[1] flex max-w-full flex-col items-center gap-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <h1 className="bulunamadi-gir bulunamadi-404 text-[112px] leading-none font-extrabold tracking-[-0.04em] sm:text-9xl">404</h1>
          <p className="bulunamadi-gir -mt-8 text-sm/relaxed text-balance text-text/80 [animation-delay:.12s]">{aciklama}</p>
        </div>
        <div className="bulunamadi-gir flex flex-wrap justify-center gap-2 [animation-delay:.24s]">
          {dugmeler.map((d, i) => {
            const sinif = i === 0 ? ANA : IKINCIL
            const ic = (
              <>
                <Ikon ad={d.ikon} className="size-4" />
                {d.etiket}
              </>
            )
            return d.adres ? (
              <Link key={d.etiket} to={d.adres} className={sinif}>
                {ic}
              </Link>
            ) : (
              <button key={d.etiket} type="button" onClick={d.tikla} className={sinif}>
                {ic}
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
