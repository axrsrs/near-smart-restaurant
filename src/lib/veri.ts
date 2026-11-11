/* Veri katmanı: personel, cihazlar ve siparişler sunucuda tutulur; buradaki işlevler sunucuyu çağırır.
   Ürünler NearMenu'den okunur (src/lib/menu.ts). Tutar, sıra numarası, PIN ve yetki denetimi sunucudadır. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { menuYukle } from './menu'
import { cihazCagir, type CihazEkrani, type Sonuc } from './oturum'
import { cagir, hataMetni } from './sunucu'

export type { Sonuc }
export type Yetki = 'kasa' | 'mutfak'
export type PersonelKaydi = { id: string; ad: string; yetkiler: Yetki[]; aktif: boolean }
export type CihazKaydi = { id: string; ekran: CihazEkrani; ad: string; son_gorulme: string | null; created_at: string; personel: string | null }
export type SiparisTuru = 'burada' | 'paket'
export type Odeme = 'nakit' | 'kart'
export type SiparisDurumu = 'hazirlaniyor' | 'hazir' | 'teslim' | 'iptal'
export type Kalem = { urunId: string; ad: string; fiyat: number; adet: number; not: string }
export type Siparis = {
  id: string
  kod: string // müşteri takip adresi için tahmin edilemez kod
  no: number // her gün 1'den başlar
  zaman: number
  kalemler: Kalem[]
  toplam: number // kuruş; sunucu menü fiyatından hesaplar
  tur: SiparisTuru
  odeme: Odeme
  personelAd: string
  durum: SiparisDurumu
}

type HamSiparis = {
  id: string
  no: number
  zaman: string
  tur: SiparisTuru
  durum: SiparisDurumu
  kalemler: { urun_id: string; ad: string; fiyat: number; adet: number; not: string }[]
  personel_ad: string
  odeme?: Odeme
  toplam?: number
  takip_kod?: string
}
const cevir = (h: HamSiparis): Siparis => ({
  id: h.id,
  kod: h.takip_kod ?? '',
  no: h.no,
  zaman: Date.parse(h.zaman),
  kalemler: (h.kalemler ?? []).map((k) => ({ urunId: k.urun_id, ad: k.ad, fiyat: k.fiyat, adet: k.adet, not: k.not ?? '' })),
  toplam: h.toplam ?? 0,
  tur: h.tur,
  odeme: h.odeme ?? 'nakit',
  personelAd: h.personel_ad ?? '',
  durum: h.durum,
})

type Yanit = { tamam: boolean; hata?: string }
const sonuc = (y: Yanit): Sonuc => (y.tamam ? { tamam: true } : { tamam: false, hata: y.hata ?? 'İşlem tamamlanamadı.' })
async function dene(is: () => Promise<Yanit>): Promise<Sonuc> {
  try {
    return sonuc(await is())
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/* ───────── yönetim: personel ve cihazlar (işletme sahibi oturumuyla) ───────── */
export const personelListesi = (isletme: string) => cagir<PersonelKaydi[]>('tetra_personel_liste', { p_restaurant: isletme })

export const personelKaydet = (isletme: string, p: { id?: string; ad: string; yetkiler: Yetki[]; pin: string; aktif: boolean }) =>
  dene(() => cagir<Yanit>('tetra_personel_kaydet', { p_restaurant: isletme, p_id: p.id ?? null, p_ad: p.ad, p_yetkiler: p.yetkiler, p_pin: p.pin, p_aktif: p.aktif }))

export const personelSil = (isletme: string, id: string) => dene(() => cagir<Yanit>('tetra_personel_sil', { p_restaurant: isletme, p_id: id }))

export const cihazListesi = (isletme: string) => cagir<CihazKaydi[]>('tetra_cihaz_liste', { p_restaurant: isletme })

export const cihazSil = (isletme: string, id: string) => dene(() => cagir<Yanit>('tetra_cihaz_sil', { p_restaurant: isletme, p_id: id }))

/* ───────── kasa: siparişler (cihaz anahtarı + personel oturumuyla) ───────── */
let siparisler: Siparis[] = []
const dinleyenler = new Set<() => void>()
const ayarla = (l: Siparis[]) => {
  siparisler = l
  dinleyenler.forEach((f) => f())
}

/** Bugünün siparişlerini sunucudan okur. */
export async function siparisleriYukle(): Promise<Sonuc> {
  try {
    const y = await cihazCagir<{ siparisler: HamSiparis[] }>('tetra_siparisler')
    ayarla(y.siparisler.map(cevir))
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Siparişi sunucuya yazar. Fiyat gönderilmez: tutarı sunucu menüden hesaplar. Aynı istek kimliği yinelenirse tek sipariş oluşur. */
export async function siparisOlustur(s: { kalemler: { urunId: string; adet: number; not: string }[]; tur: SiparisTuru; odeme: Odeme; istek: string }): Promise<Sonuc & { siparis?: Siparis }> {
  try {
    const y = await cihazCagir<Yanit & { siparis?: HamSiparis }>('tetra_siparis_olustur', {
      p_kalemler: s.kalemler.map((k) => ({ urun_id: k.urunId, adet: k.adet, not: k.not })),
      p_tur: s.tur,
      p_odeme: s.odeme,
      p_istek: s.istek,
    })
    if (!y.tamam || !y.siparis) return { tamam: false, hata: y.hata ?? 'Sipariş kaydedilemedi.' }
    const siparis = cevir(y.siparis)
    ayarla([siparis, ...siparisler.filter((x) => x.id !== siparis.id)])
    return { tamam: true, siparis }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

export async function siparisDurumu(id: string, durum: SiparisDurumu): Promise<Sonuc> {
  try {
    const y = await cihazCagir<Yanit & { siparis?: HamSiparis }>('tetra_siparis_durum', { p_id: id, p_durum: durum })
    if (!y.tamam || !y.siparis) return { tamam: false, hata: y.hata ?? 'İşlem tamamlanamadı.' }
    const yeni = cevir(y.siparis)
    ayarla(siparisler.map((x) => (x.id === id ? yeni : x)))
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Kasadan tükendi işareti: ürünün NearMenu'deki kaydı güncellenir, QR menüde de aynı anda görünür. */
export async function tukendiAyarla(slug: string, urunId: string, tukendi: boolean): Promise<Sonuc> {
  const s = await dene(() => cihazCagir<Yanit>('tetra_tukendi', { p_urun: urunId, p_tukendi: tukendi }))
  if (s.tamam) await menuYukle(slug, true)
  return s
}

/* ───────── müşteri: sipariş takibi (takip koduyla, girişsiz) ───────── */
export type Takip = { no: number; durum: SiparisDurumu; tur: SiparisTuru; isletme: { ad: string; logo: string } }
export const takipOku = (kod: string) => cagir<Takip | null>('tetra_takip', { p_kod: kod })

/* ───────── cihaza özel ayar ───────── */
const A_FIS = 'tetra-otomatik-fis'
let otomatikFis = oku<boolean>('local', A_FIS) !== false
export function otomatikFisAyarla(acik: boolean) {
  otomatikFis = acik
  yaz('local', A_FIS, acik)
  dinleyenler.forEach((f) => f())
}

function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useSiparisler = () => useSyncExternalStore(abone, () => siparisler)
export const useOtomatikFis = () => useSyncExternalStore(abone, () => otomatikFis)
