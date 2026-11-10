import { useRef, type PointerEvent, type ReactNode } from 'react'
import AkisArkaPlan from './AkisArkaPlan'
import OnizlemeEtiketi from './OnizlemeEtiketi'
import TemaDugmesi from './TemaDugmesi'

/** Giriş ve PIN ekranlarının ortak kabuğu: akış çizgileri, cam kart, gezen ışık, fareyle 3B eğilme. */
export default function GirisKabugu({ children, genislik = 'max-w-96' }: { children: ReactNode; genislik?: string }) {
  const kart = useRef<HTMLDivElement>(null)

  const egil = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !kart.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = kart.current.getBoundingClientRect()
    const x = Math.max(-300, Math.min(300, e.clientX - r.left - r.width / 2))
    const y = Math.max(-300, Math.min(300, e.clientY - r.top - r.height / 2))
    kart.current.style.transform = `rotateX(${(-y / 30).toFixed(2)}deg) rotateY(${(x / 30).toFixed(2)}deg) translateZ(10px)`
  }
  const duzel = () => {
    if (kart.current) kart.current.style.transform = ''
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-ink px-4 pt-[max(5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AkisArkaPlan />
      <div aria-hidden="true" className="giris-zemin pointer-events-none fixed inset-0 z-0" />
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 left-4 z-10 flex items-center justify-between gap-3">
        <OnizlemeEtiketi />
        <TemaDugmesi className="ml-auto" />
      </div>
      <div className={`giris-sar relative z-[2] w-full ${genislik}`}>
        <div ref={kart} data-dalga-yok className="giris-kart" onPointerMove={egil} onPointerLeave={duzel}>
          <div className="isinlar" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <div className="cam px-6 pt-7 pb-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
