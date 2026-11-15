/* Kasa ürün görünümü: büyük kart, küçük kart ya da sade liste.
   İşletme sahibi varsayılanı Yönetim › İşletme'den seçer (bütün kasalar); her kasa kendi cihazı için değiştirebilir.
   Cihaz seçimi bu tarayıcıda saklanır; boşsa işletmenin varsayılanı geçerlidir. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'

export type KasaGorunum = 'buyuk' | 'kucuk' | 'liste'
export const KASA_GORUNUMLERI: { kod: KasaGorunum; ad: string; not: string }[] = [
  { kod: 'buyuk', ad: 'Büyük kart', not: 'Fotoğraflı, az ürünlü menüler için' },
  { kod: 'kucuk', ad: 'Küçük kart', not: 'Fotoğraflı, ekrana yaklaşık iki kat ürün sığar' },
  { kod: 'liste', ad: 'Sade liste', not: 'Fotoğrafsız, yalnızca ad ve fiyat; çok ürünlü menüler için' },
]
export const kasaGorunumAdi = (k: KasaGorunum) => KASA_GORUNUMLERI.find((x) => x.kod === k)?.ad ?? ''
const gecerli = (v: unknown): KasaGorunum | null => (v === 'buyuk' || v === 'kucuk' || v === 'liste' ? v : null)

const A = 'tetra-kasa-gorunum'
let cihazSecimi: KasaGorunum | null = gecerli(oku<string>('local', A))
const dinleyenler = new Set<() => void>()

/** null: bu cihaz işletmenin varsayılanını kullanır. */
export function cihazGorunumuAyarla(g: KasaGorunum | null) {
  cihazSecimi = g
  yaz('local', A, g)
  dinleyenler.forEach((f) => f())
}
const abone = (f: () => void) => {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useCihazGorunumu = () => useSyncExternalStore(abone, () => cihazSecimi)
export const isletmeGorunumu = (v: unknown): KasaGorunum => gecerli(v) ?? 'buyuk'
