/* Veri katmanı: personel, cihazlar ve siparişler sunucuda tutulur; buradaki işlevler sunucuyu çağırır.
   Ürünler NearMenu'den okunur (src/lib/menu.ts). Tutar, sıra numarası, PIN ve yetki denetimi sunucudadır. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { menuYukle } from './menu'
import { bildirimGonder, cihazCagir, type CihazEkrani, type Sonuc } from './oturum'
import { cagir, hataMetni } from './sunucu'

export type { Sonuc }
export type Yetki = 'kasa' | 'mutfak'
export type PersonelKaydi = { id: string; ad: string; yetkiler: Yetki[]; aktif: boolean; indirim?: boolean }
export type CihazKaydi = { id: string; ekran: CihazEkrani; ad: string; son_gorulme: string | null; created_at: string; personel: string | null }
export type SiparisTuru = 'burada' | 'paket'
export type Odeme = 'nakit' | 'kart'
export type SiparisDurumu = 'hazirlaniyor' | 'hazir' | 'teslim' | 'iptal'
export type Kalem = { urunId: string; ad: string; fiyat: number; adet: number; not: string; kdv: number | null }
export type KdvOrani = 1 | 10 | 20
export const KDV_ORANLARI: KdvOrani[] = [1, 10, 20]
/** Mali fiş durumu. null: sipariş takip dışında (takip kapalıyken ya da özellikten önce alınmış). */
export type MaliDurum = { durum: 'bekliyor' | 'kesildi'; fisNo: string; zaman: number | null; kisi: string } | null
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
  gun: string
  mali: MaliDurum
  indirim: Indirim | null
  ikram: boolean // ikram ya da personel yemeği
}
export type IndirimTuru = 'yuzde' | 'tutar' | 'ikram' | 'personel'
export type Indirim = { tur: IndirimTuru; deger: number | null; tutar: number; brut: number; aciklama: string; kisi: string }
/** Kasadan gönderilen indirim isteği. deger: yüzde (1–100) ya da kuruş. */
export type IndirimIstegi = { tur: IndirimTuru; deger: number | null; aciklama: string }
export const INDIRIM_ADI: Record<IndirimTuru, string> = { yuzde: 'İndirim', tutar: 'İndirim', ikram: 'İkram', personel: 'Personel yemeği' }
/** Sunucudaki hesabın aynısı: indirim tutarı (kuruş). Geçersizse null. */
export function indirimTutari(brut: number, i: IndirimIstegi): number | null {
  const d = i.deger
  if (i.tur === 'ikram') return brut
  if (i.tur === 'tutar') return d !== null && d >= 1 && d <= brut ? d : null
  const y = i.tur === 'personel' ? (d ?? 100) : d
  return y !== null && y >= 1 && y <= 100 ? Math.round((brut * y) / 100) : null
}

type HamSiparis = {
  id: string
  no: number
  zaman: string
  tur: SiparisTuru
  durum: SiparisDurumu
  gun?: string
  kalemler: { urun_id: string; ad: string; fiyat: number; adet: number; not: string; kdv?: number }[]
  personel_ad: string
  odeme?: Odeme
  toplam?: number
  takip_kod?: string
  mali?: { durum: 'bekliyor' | 'kesildi'; fis_no: string | null; zaman: string | null; kisi: string | null } | null
  indirim?: Indirim | null
  ikram?: boolean
}
const cevir = (h: HamSiparis): Siparis => ({
  id: h.id,
  kod: h.takip_kod ?? '',
  no: h.no,
  zaman: Date.parse(h.zaman),
  kalemler: (h.kalemler ?? []).map((k) => ({ urunId: k.urun_id, ad: k.ad, fiyat: k.fiyat, adet: k.adet, not: k.not ?? '', kdv: typeof k.kdv === 'number' ? k.kdv : null })),
  toplam: h.toplam ?? 0,
  tur: h.tur,
  odeme: h.odeme ?? 'nakit',
  personelAd: h.personel_ad ?? '',
  durum: h.durum,
  gun: h.gun ?? '',
  indirim: h.indirim ?? null,
  ikram: Boolean(h.ikram),
  mali: h.mali ? { durum: h.mali.durum, fisNo: h.mali.fis_no ?? '', zaman: h.mali.zaman ? Date.parse(h.mali.zaman) : null, kisi: h.mali.kisi ?? '' } : null,
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

export const personelKaydet = (isletme: string, p: { id?: string; ad: string; yetkiler: Yetki[]; pin: string; aktif: boolean; indirim?: boolean }) =>
  dene(() => cagir<Yanit>('tetra_personel_kaydet', { p_restaurant: isletme, p_id: p.id ?? null, p_ad: p.ad, p_yetkiler: p.yetkiler, p_pin: p.pin, p_aktif: p.aktif, p_indirim: p.indirim ?? null }))

export const personelSil = (isletme: string, id: string) => dene(() => cagir<Yanit>('tetra_personel_sil', { p_restaurant: isletme, p_id: id }))

export const cihazListesi = (isletme: string) => cagir<CihazKaydi[]>('tetra_cihaz_liste', { p_restaurant: isletme })

export const cihazSil = (isletme: string, id: string) => dene(() => cagir<Yanit>('tetra_cihaz_sil', { p_restaurant: isletme, p_id: id }))

/* ───────── kasa: siparişler (cihaz anahtarı + personel oturumuyla) ───────── */
let siparisler: Siparis[] = []
let gun = '' // sunucunun "bugün"ü (İstanbul saati); önceki günden kalan siparişleri ayırt etmek için
/** Sunucunun bugün saydığı tarih (YYYY-AA-GG); henüz okunmadıysa boş. */
export const siparisGunu = () => gun
const dinleyenler = new Set<() => void>()
const ayarla = (l: Siparis[]) => {
  siparisler = l
  dinleyenler.forEach((f) => f())
}

/** Bugünün siparişlerini sunucudan okur. */
export async function siparisleriYukle(): Promise<Sonuc & { liste?: Siparis[] }> {
  try {
    const y = await cihazCagir<{ gun?: string; siparisler: HamSiparis[] }>('tetra_siparisler')
    const liste = y.siparisler.map(cevir)
    gun = y.gun ?? gun
    ayarla(liste)
    return { tamam: true, liste }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Siparişi sunucuya yazar. Fiyat gönderilmez: tutarı sunucu menüden hesaplar. Aynı istek kimliği yinelenirse tek sipariş oluşur. */
export async function siparisOlustur(s: { kalemler: { urunId: string; adet: number; not: string }[]; tur: SiparisTuru; odeme: Odeme; istek: string; indirim?: IndirimIstegi | null }): Promise<Sonuc & { siparis?: Siparis }> {
  try {
    const y = await cihazCagir<Yanit & { siparis?: HamSiparis }>('tetra_siparis_olustur', {
      p_kalemler: s.kalemler.map((k) => ({ urun_id: k.urunId, adet: k.adet, not: k.not })),
      p_tur: s.tur,
      p_odeme: s.odeme,
      p_istek: s.istek,
      p_indirim: s.indirim ? { tur: s.indirim.tur, deger: s.indirim.deger, aciklama: s.indirim.aciklama.trim() } : null,
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
    const y = await cihazCagir<Yanit & { siparis?: HamSiparis; bildirim?: boolean }>('tetra_siparis_durum', { p_id: id, p_durum: durum })
    if (!y.tamam || !y.siparis) return { tamam: false, hata: y.hata ?? 'İşlem tamamlanamadı.' }
    if (y.bildirim) bildirimGonder(id) // müşteri bildirim istemişse telefonuna "hazır" bildirimi gider
    const yeni = cevir(y.siparis)
    ayarla(siparisler.map((x) => (x.id === id ? yeni : x)))
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Mali fiş işareti (kasadan): yazarkasa fişi kesildi / geri al. Fiş numarası isteğe bağlıdır. */
export async function maliIsaretle(id: string, kesildi: boolean, fisNo = ''): Promise<Sonuc> {
  try {
    const y = await cihazCagir<Yanit & { siparis?: HamSiparis }>('tetra_mali_isaretle', { p_id: id, p_kesildi: kesildi, p_fis_no: fisNo.trim() || null })
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

/* ───────── TV ekranı: yalnızca numara ve durum (personel oturumu gerekmez) ───────── */
export type TvSiparis = { no: number; durum: 'hazirlaniyor' | 'hazir'; hazirZaman: number | null }
export async function tvListesi(): Promise<TvSiparis[]> {
  const y = await cihazCagir<{ siparisler: { no: number; durum: 'hazirlaniyor' | 'hazir'; hazir_zaman: string | null }[] }>('tetra_siparisler', {}, false)
  return y.siparisler.map((s) => ({ no: s.no, durum: s.durum, hazirZaman: s.hazir_zaman ? Date.parse(s.hazir_zaman) : null }))
}

/* ───────── müşteri: sipariş takibi (takip koduyla, girişsiz) ───────── */
export type Takip = { no: number; durum: SiparisDurumu; tur: SiparisTuru; isletme: { ad: string; logo: string }; gorunum?: unknown }
export const takipOku = (kod: string) => cagir<Takip | null>('tetra_takip', { p_kod: kod })

/* ───────── rapor (işletme sahibi) ───────── */
export type RaporGunu = { gun: string; siparis: number; iptal: number; ciro: number; nakit: number; kart: number; burada: number; paket: number }
export type KdvSatiri = { oran: number; tutar: number; kdv: number } // tutar KDV dahil, kuruş
export type Rapor = {
  ozet: Omit<RaporGunu, 'gun'> & { indirim?: number }
  gunler: RaporGunu[]
  urunler: { ad: string; adet: number; ciro: number }[]
  kdv?: KdvSatiri[]
  mali?: { bekleyen: number; bekleyen_tutar: number }
}
export const raporOku = (isletme: string, bas: string, bit: string) => cagir<Rapor>('tetra_rapor', { p_restaurant: isletme, p_bas: bas, p_bit: bit })

/* ───────── mali ayarlar, ürün KDV oranları, fişi kesilmemiş siparişler (işletme sahibi) ───────── */
export type MaliAyar = { kdv_varsayilan: KdvOrani; mali_takip: boolean; kasa_gorunum?: string; mutfak_fisi?: MutfakFisiYeri; urunler: Record<string, KdvOrani> }
export type MutfakFisiYeri = 'kapali' | 'kasa' | 'mutfak'
export const mutfakFisiKaydet = (isletme: string, yer: MutfakFisiYeri) => dene(() => cagir<Yanit>('tetra_mutfak_fisi_kaydet', { p_restaurant: isletme, p_yer: yer }))
/** İşletmenin bütün kasaları için varsayılan ürün görünümü (her kasa kendi cihazında değiştirebilir). */
export const kasaGorunumKaydet = (isletme: string, gorunum: string) => dene(() => cagir<Yanit>('tetra_kasa_gorunum_kaydet', { p_restaurant: isletme, p_gorunum: gorunum }))
export const maliAyarOku = (isletme: string) => cagir<MaliAyar>('tetra_mali_ayar_oku', { p_restaurant: isletme })
export const maliAyarKaydet = (isletme: string, kdv: KdvOrani, takip: boolean) =>
  dene(() => cagir<Yanit>('tetra_mali_ayar_kaydet', { p_restaurant: isletme, p_kdv_varsayilan: kdv, p_mali_takip: takip }))
/** oran null: ürün işletmenin varsayılan oranını kullanır */
export const kdvKaydet = (isletme: string, urun: string, oran: KdvOrani | null) => dene(() => cagir<Yanit>('tetra_kdv_kaydet', { p_restaurant: isletme, p_urun: urun, p_oran: oran }))
export const maliBekleyenler = async (isletme: string) => (await cagir<HamSiparis[]>('tetra_mali_bekleyen', { p_restaurant: isletme })).map(cevir)
export const maliIsaretleSahip = (isletme: string, id: string, kesildi: boolean, fisNo = '') =>
  dene(() => cagir<Yanit>('tetra_mali_isaretle_sahip', { p_restaurant: isletme, p_id: id, p_kesildi: kesildi, p_fis_no: fisNo.trim() || null }))

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

/* ───────── gün sonu ───────── */
export type GunOzeti = {
  gun: string
  siparis: number
  ciro: number
  nakit: number
  kart: number
  burada: number
  paket: number
  ilk: string | null
  son: string | null
  iptal: { adet: number; tutar: number; liste: { no: number; tutar: number; kisi: string; zaman: string | null }[] }
  personel: { ad: string; siparis: number; ciro: number; nakit: number; kart: number }[]
  kdv: KdvSatiri[]
  mali: { bekleyen: number; tutar: number }
  indirim?: { adet: number; tutar: number; liste: { no: number; tur: IndirimTuru; tutar: number; aciklama: string; kisi: string }[] }
  urunler: { ad: string; adet: number; ciro: number }[]
}
export type GunSonu = { id: string; gun: string; zaman: string; personel_ad: string; beklenen_nakit: number; sayilan_nakit: number | null; fark: number | null; aciklama: string; ozet: GunOzeti }

/** Kasa: bugünün özeti ve bugün alınmış gün sonu kayıtları. */
export const gunSonuOku = () => cihazCagir<{ ozet: GunOzeti; kapanislar: GunSonu[] }>('tetra_gun_sonu_oku')
/** Kasa: gün sonunu kaydeder. sayilan (kuruş) boş bırakılabilir. */
export async function gunSonuKaydet(sayilan: number | null, aciklama: string): Promise<Sonuc & { kapanis?: GunSonu }> {
  try {
    const y = await cihazCagir<Yanit & { kapanis?: GunSonu }>('tetra_gun_sonu_kaydet', { p_sayilan: sayilan, p_aciklama: aciklama.trim() })
    return y.tamam && y.kapanis ? { tamam: true, kapanis: y.kapanis } : { tamam: false, hata: y.hata ?? 'Gün sonu kaydedilemedi.' }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}
/** Yönetim: tarih aralığındaki gün sonu kayıtları. */
export const gunSonuListe = (isletme: string, bas: string, bit: string) => cagir<GunSonu[]>('tetra_gun_sonu_liste', { p_restaurant: isletme, p_bas: bas, p_bit: bit })
