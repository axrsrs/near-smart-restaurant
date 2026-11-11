import { useEffect, useId, useRef, type ReactNode } from 'react'
import Ikon from './Ikon'

/** Telefonda alttan açılan sayfa, geniş ekranda ortalanmış pencere. Esc ve dışına dokunma kapatır. */
export default function Pencere({ baslik, kapat, children }: { baslik: string; kapat: () => void; children: ReactNode }) {
  const id = useId()
  const kutu = useRef<HTMLDivElement>(null)

  const kapatRef = useRef(kapat)
  useEffect(() => {
    kapatRef.current = kapat
  })

  /* yalnızca açılışta çalışır: ilk alana odaklanır, Esc ile kapanır, Tab pencerenin içinde döner */
  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return kapatRef.current()
      if (e.key !== 'Tab' || !kutu.current) return
      const odaklar = [...kutu.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]')].filter((x) => x.offsetParent !== null)
      if (!odaklar.length) return
      const ilk = odaklar[0]
      const son = odaklar[odaklar.length - 1]
      const simdiki = document.activeElement
      if (e.shiftKey ? simdiki === ilk || !kutu.current.contains(simdiki) : simdiki === son || !kutu.current.contains(simdiki)) {
        e.preventDefault()
        ;(e.shiftKey ? son : ilk).focus()
      }
    }
    document.addEventListener('keydown', tus)
    const tasma = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    kutu.current?.querySelector<HTMLElement>('[data-ilk], input, select, textarea')?.focus()
    return () => {
      document.removeEventListener('keydown', tus)
      document.body.style.overflow = tasma
      onceki?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) kapat()
      }}
    >
      <div
        ref={kutu}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-ink-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <h2 id={id} className="min-w-0 flex-1 text-lg font-semibold tracking-tight">
            {baslik}
          </h2>
          <button type="button" onClick={kapat} aria-label="Kapat" className="grid size-11 flex-none place-items-center rounded-full text-muted hover:text-text">
            <Ikon ad="kapat" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
