import { useEffect, useRef } from 'react'

/**
 * Arka planda yavaşça akan çizgiler (iki yönde 36'şar eğri, her biri 20–30 sn'de bir tur).
 * SVG yerine canvas: saniyede en fazla 30 kare çizilir, sekme gizliyken durur, üstteki yazılar yeniden boyanmaz.
 * Renk, kapsayıcının yazı renginden (currentColor) okunur; tema değişince kendiliğinden güncellenir.
 */
type Cizgi = { p: Path2D; L: number; w: number; a: number; sure: number }

function cizgiVerisi(): Cizgi[] {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  document.body.appendChild(svg)
  const liste: Cizgi[] = []
  for (const pos of [1, -1]) {
    for (let i = 0; i < 36; i++) {
      const k = i * 5 * pos
      const y = i * 6
      const d =
        `M-${380 - k} -${189 + y}C-${380 - k} -${189 + y} -${312 - k} ${216 - y} ${152 - k} ${343 - y}` +
        `C${616 - k} ${470 - y} ${684 - k} ${875 - y} ${684 - k} ${875 - y}`
      const pe = document.createElementNS(ns, 'path')
      pe.setAttribute('d', d)
      svg.appendChild(pe)
      let L = 1400
      try {
        L = pe.getTotalLength() || 1400
      } catch {
        /* eski tarayıcı: yaklaşık uzunluk */
      }
      liste.push({ p: new Path2D(d), L, w: 0.5 + i * 0.03, a: Math.min(1, 0.1 + i * 0.03), sure: 20000 + Math.random() * 10000 })
    }
  }
  svg.remove()
  return liste
}

export default function AkanCizgiler({ className = '' }: { className?: string }) {
  const tuval = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = tuval.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || typeof Path2D === 'undefined') return
    const liste = cizgiVerisi()
    const hareketsiz = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let W = 0
    let H = 0
    let dpr = 1
    let son = 0
    let raf = 0

    const boyut = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      W = cv.clientWidth
      H = cv.clientHeight
      cv.width = Math.max(1, Math.round(W * dpr))
      cv.height = Math.max(1, Math.round(H * dpr))
    }
    const ciz = (simdi: number) => {
      const sc = Math.max(W / 696, H / 316)
      const ox = (W - 696 * sc) / 2
      const oy = (H - 316 * sc) / 2
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox * dpr, oy * dpr)
      ctx.strokeStyle = getComputedStyle(cv).color
      for (const c of liste) {
        let uz = 1
        let kay = 0
        let op = 0.35
        if (!hareketsiz) {
          const f = ((simdi - t0) % c.sure) / c.sure
          uz = 0.3 + 0.7 * f /* çizgi boyu: %30 → %100 */
          kay = f < 0.5 ? f * 2 : (1 - f) * 2 /* kayma: 0 → 1 → 0 */
          op = 0.3 + 0.3 * (1 - Math.abs(2 * f - 1)) /* saydamlık: .3 → .6 → .3 */
        }
        ctx.globalAlpha = c.a * op
        ctx.lineWidth = c.w
        ctx.setLineDash([uz * c.L, c.L])
        ctx.lineDashOffset = -kay * c.L
        ctx.stroke(c.p)
      }
    }
    const dongu = (simdi: number) => {
      raf = 0
      if (document.hidden) return
      if (simdi - son >= 33) {
        son = simdi
        ciz(simdi)
      }
      raf = requestAnimationFrame(dongu)
    }
    const yenidenBoyut = () => {
      boyut()
      ciz(performance.now())
    }
    const gorunurluk = () => {
      if (!document.hidden && !raf && !hareketsiz) raf = requestAnimationFrame(dongu)
    }
    /* tema değişince (html[data-theme]) renk yeniden okunur */
    const gozcu = new MutationObserver(() => ciz(performance.now()))
    gozcu.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    yenidenBoyut()
    window.addEventListener('resize', yenidenBoyut, { passive: true })
    document.addEventListener('visibilitychange', gorunurluk)
    if (!hareketsiz) raf = requestAnimationFrame(dongu)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      gozcu.disconnect()
      window.removeEventListener('resize', yenidenBoyut)
      document.removeEventListener('visibilitychange', gorunurluk)
    }
  }, [])

  return <canvas ref={tuval} aria-hidden="true" className={`pointer-events-none absolute inset-0 block size-full ${className}`} />
}
