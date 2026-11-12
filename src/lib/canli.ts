/* Canlı güncelleme: sunucu, işletmenin gizli kanalına yalnızca "şu değişti" haberi yollar (içinde veri yoktur).
   Haberi alan ekran güncel veriyi kendi cihaz anahtarıyla sunucudan okur. Bağlantı koparsa ekranlar
   düzenli aralıkla sormaya devam eder; canlı bağlantı yalnızca gecikmeyi kısaltır. */
import { useEffect, useRef, useState } from 'react'
import { sunucu } from './sunucu'

export type Konu = 'siparis' | 'menu' | 'personel' | 'durum'

/** Kanala abone olur; haber geldikçe geriCagri çalışır. Dönüş: canlı bağlantı kurulu mu. */
export function useCanli(kanal: string, geriCagri: (konu: Konu) => void, onek = 'tetra'): boolean {
  const [bagli, setBagli] = useState(false)
  const cb = useRef(geriCagri)
  useEffect(() => {
    cb.current = geriCagri
  })

  useEffect(() => {
    if (!kanal) return
    const k = sunucu
      .channel(`${onek}:${kanal}`)
      .on('broadcast', { event: 'degisti' }, (ileti) => {
        const konu = (ileti.payload as { konu?: unknown } | undefined)?.konu
        if (konu === 'siparis' || konu === 'menu' || konu === 'personel' || konu === 'durum') cb.current(konu)
      })
      .subscribe((durum) => setBagli(durum === 'SUBSCRIBED'))
    return () => {
      setBagli(false)
      void sunucu.removeChannel(k)
    }
  }, [kanal, onek])

  return bagli
}

/** Düzenli tazeleme: canlı bağlantı varken seyrek (güvence), yokken sık; ekrana geri dönüldüğünde hemen. */
export function useTazele(is: () => void, bagli: boolean, sikMs = 15_000, seyrekMs = 600_000) {
  const ref = useRef(is)
  useEffect(() => {
    ref.current = is
  })
  useEffect(() => {
    const calis = () => {
      if (!document.hidden) ref.current()
    }
    calis()
    const sayac = setInterval(calis, bagli ? seyrekMs : sikMs)
    document.addEventListener('visibilitychange', calis)
    window.addEventListener('online', calis)
    return () => {
      clearInterval(sayac)
      document.removeEventListener('visibilitychange', calis)
      window.removeEventListener('online', calis)
    }
  }, [bagli, sikMs, seyrekMs])
}
