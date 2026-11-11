import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** Verilen metnin QR kodunu SVG olarak çizer (her zaman beyaz zemin üstüne siyah: okuyucular böyle ister). */
export default function QrKod({ metin, className = '' }: { metin: string; className?: string }) {
  const { yol, boyut } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(metin)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`
    return { yol: d, boyut: n + 4 }
  }, [metin])
  return (
    <svg viewBox={`0 0 ${boyut} ${boyut}`} role="img" aria-label="Sipariş takip QR kodu" shapeRendering="crispEdges" className={className}>
      <rect width={boyut} height={boyut} fill="#fff" />
      <path d={yol} fill="#000" />
    </svg>
  )
}
