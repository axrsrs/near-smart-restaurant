/* Fiyatlar kuruş olarak (tam sayı) tutulur; ekranda Türk lirası biçiminde gösterilir. */
const bicim = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

export const tl = (kurus: number) => bicim.format(kurus / 100)

/** Yazı kutusuna geri koymak için: 4550 → "45,50", 18000 → "180" */
export const fiyatYazi = (kurus: number) =>
  (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: kurus % 100 ? 2 : 0, maximumFractionDigits: 2, useGrouping: false })

export const EN_YUKSEK_FIYAT = 100_000_000 // 1.000.000 ₺

/** "45", "45,5", "45.50", "1.250,00" → kuruş. Geçersizse null. */
export function fiyatCoz(metin: string): number | null {
  let m = metin.replace(/[\s₺]|TL/gi, '')
  if (m.includes(',')) m = m.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(m)) m = m.replace(/\./g, '')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(m)) return null
  const kurus = Math.round(Number(m) * 100)
  return kurus <= EN_YUKSEK_FIYAT ? kurus : null
}
