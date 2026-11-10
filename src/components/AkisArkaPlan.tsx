import { useEffect, useRef } from 'react'
import { temaOku } from '../lib/tema'

type Yol = { sol: boolean; y0: number; t: number; hiz: number }
type Dalga = { x: number; y: number; r: number; can: number }

/** NEAR giriş arka planı: kenarlardan merkeze akan noktalı eğriler; boş alana dokununca dalga yayılır. */
export default function AkisArkaPlan() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const tuval = ref.current
    const cx = tuval?.getContext('2d')
    if (!tuval || !cx) return
    const az = matchMedia('(prefers-reduced-motion: reduce)')
    let G = 0
    let Y = 0
    let yollar: Yol[] = []
    let dalgalar: Dalga[] = []
    let dongu = 0

    const ciz = (ilerle: boolean) => {
      cx.clearRect(0, 0, G, Y)
      const mx = G / 2
      const my = Y / 2
      if (ilerle) {
        dalgalar.forEach((d) => {
          d.r += 15
          d.can -= 0.015
        })
        dalgalar = dalgalar.filter((d) => d.can > 0)
      }
      const acik = temaOku() === 'light'
      cx.lineWidth = 1.2
      cx.strokeStyle = acik ? 'rgba(21,21,20,0.28)' : 'rgba(255,255,255,0.3)'
      cx.setLineDash([1, 4])
      const noktalar: number[] = []
      for (const y of yollar) {
        const x0 = y.sol ? 0 : G
        const x1 = y.sol ? mx * 0.5 : G - mx * 0.5
        const x2 = y.sol ? mx * 0.8 : G - mx * 0.8
        cx.beginPath()
        cx.moveTo(x0, y.y0)
        cx.bezierCurveTo(x1, y.y0, x2, my, mx, my)
        cx.stroke()
        if (ilerle) {
          y.t += y.hiz
          if (y.t > 1) {
            y.t = 0
            y.y0 += (Math.random() - 0.5) * 10
          }
        }
        const t = y.t
        const u = 1 - t
        const qx = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * mx
        const qy = u * u * u * y.y0 + 3 * u * u * t * y.y0 + 3 * u * t * t * my + t * t * t * my
        let dx = 0
        let dy = 0
        for (const e of dalgalar) {
          const ax = qx - e.x
          const ay = qy - e.y
          const m = Math.hypot(ax, ay)
          if (m && m < e.r + 120 && m > e.r - 120) {
            const f = (1 - Math.abs(m - e.r) / 120) * e.can
            dx += (ax / m) * f * 80
            dy += (ay / m) * f * 80
          }
        }
        noktalar.push(qx + dx, qy + dy)
      }
      cx.setLineDash([])
      cx.fillStyle = acik ? 'rgba(21,21,20,0.7)' : 'rgba(255,255,255,0.7)'
      for (let j = 0; j < noktalar.length; j += 2) cx.fillRect(noktalar[j] - 1.5, noktalar[j + 1] - 1.5, 3, 3)
    }

    const boyutla = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      G = window.innerWidth
      Y = window.innerHeight
      tuval.width = Math.round(G * dpr)
      tuval.height = Math.round(Y * dpr)
      cx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = G < 640 ? 40 : 80
      yollar = Array.from({ length: n }, (_, i) => ({
        sol: i % 2 === 0,
        y0: (i / n) * Y * 1.4 - Y * 0.2,
        t: Math.random(),
        hiz: 0.0015 + Math.random() * 0.002,
      }))
      ciz(false)
    }

    const kare = () => {
      if (!document.hidden) ciz(true)
      dongu = requestAnimationFrame(kare)
    }
    const dokun = (e: PointerEvent) => {
      if (az.matches) return
      if ((e.target as Element | null)?.closest?.('[data-dalga-yok]')) return
      dalgalar.push({ x: e.clientX, y: e.clientY, r: 0, can: 1 })
    }
    /* hareket azaltılmışsa tek kare çizilir; tema değişince yeniden boyanması için gözlenir */
    const gozcu = new MutationObserver(() => ciz(false))
    gozcu.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    boyutla()
    window.addEventListener('resize', boyutla)
    document.addEventListener('pointerdown', dokun, { passive: true })
    if (!az.matches) dongu = requestAnimationFrame(kare)
    return () => {
      cancelAnimationFrame(dongu)
      gozcu.disconnect()
      window.removeEventListener('resize', boyutla)
      document.removeEventListener('pointerdown', dokun)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 block h-full w-full" />
}
