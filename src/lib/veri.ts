/* Veri katmanı: işletme bilgileri, kategoriler, ürünler, personel.
   ŞU AN: veriler bu cihazın tarayıcısında saklanır (sr-veri). Sunucu bağlanınca yalnızca bu dosyanın
   içi değişir; ekranlar aynı işlevleri çağırmaya devam eder. Tüm girdiler burada denetlenir. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { EN_YUKSEK_FIYAT } from './para'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }
export type Yetki = 'kasa' | 'mutfak'
export type Isletme = { ad: string; sube: string; logo: string | null }
export type Kategori = { id: string; ad: string }
export type Urun = { id: string; kategoriId: string; ad: string; fiyat: number; satista: boolean }
export type PersonelKaydi = { id: string; ad: string; yetkiler: Yetki[]; pinOzet: string; aktif: boolean }
type Veri = { surum: 1; tuz: string; isletme: Isletme; kategoriler: Kategori[]; urunler: Urun[]; personel: PersonelKaydi[] }

const ANAHTAR = 'sr-veri'
const kimlik = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const bos = (): Veri => ({
  surum: 1,
  tuz: kimlik(),
  isletme: { ad: 'İşletmem', sube: '', logo: null },
  kategoriler: [],
  urunler: [],
  personel: [],
})

function yukle(): Veri {
  const v = oku<Partial<Veri>>('local', ANAHTAR)
  if (!v || v.surum !== 1 || !Array.isArray(v.kategoriler) || !Array.isArray(v.urunler) || !Array.isArray(v.personel) || !v.isletme) return bos()
  return { ...bos(), ...v } as Veri
}

let veri = yukle()
const dinleyenler = new Set<() => void>()

const TAMAM: Sonuc = { tamam: true }
const hata = (h: string): Sonuc => ({ tamam: false, hata: h })

/** Yeni durumu kaydeder. Tarayıcı yazmayı reddederse (kota) değişiklik uygulanmaz. */
function kaydet(yeni: Veri): Sonuc {
  const yazildi = yaz('local', ANAHTAR, yeni)
  if (!yazildi && oku('local', ANAHTAR) !== null) return hata('Kaydedilemedi: tarayıcının depolama alanı dolu.')
  veri = yeni
  dinleyenler.forEach((f) => f())
  return TAMAM
}

const kucuk = (s: string) => s.trim().toLocaleLowerCase('tr')
const duzAd = (s: string) => s.trim().replace(/\s+/g, ' ')

/* ── işletme ── */
export function isletmeKaydet(i: Isletme): Sonuc {
  const ad = duzAd(i.ad)
  const sube = duzAd(i.sube)
  if (ad.length < 2 || ad.length > 60) return hata('İşletme adı 2–60 karakter olmalı.')
  if (sube.length > 60) return hata('Şube adı en fazla 60 karakter olabilir.')
  if (i.logo !== null && !/^data:image\/(png|jpeg|webp);base64,/.test(i.logo)) return hata('Logo dosyası okunamadı.')
  return kaydet({ ...veri, isletme: { ad, sube, logo: i.logo } })
}

/* ── kategoriler (sıra = dizideki sıra; kasada da bu sırayla görünür) ── */
function kategoriAdiDenetle(ad: string, haricId?: string): string | null {
  if (ad.length < 2 || ad.length > 40) return 'Kategori adı 2–40 karakter olmalı.'
  if (veri.kategoriler.some((k) => k.id !== haricId && kucuk(k.ad) === kucuk(ad))) return 'Bu adda bir kategori zaten var.'
  return null
}

export function kategoriEkle(adHam: string): Sonuc & { id?: string } {
  const ad = duzAd(adHam)
  const h = kategoriAdiDenetle(ad)
  if (h) return hata(h)
  if (veri.kategoriler.length >= 50) return hata('En fazla 50 kategori eklenebilir.')
  const id = kimlik()
  const s = kaydet({ ...veri, kategoriler: [...veri.kategoriler, { id, ad }] })
  return s.tamam ? { tamam: true, id } : s
}

export function kategoriAdDegistir(id: string, adHam: string): Sonuc {
  const ad = duzAd(adHam)
  const h = kategoriAdiDenetle(ad, id)
  if (h) return hata(h)
  return kaydet({ ...veri, kategoriler: veri.kategoriler.map((k) => (k.id === id ? { ...k, ad } : k)) })
}

export function kategoriTasi(id: string, yon: -1 | 1): Sonuc {
  const i = veri.kategoriler.findIndex((k) => k.id === id)
  const j = i + yon
  if (i < 0 || j < 0 || j >= veri.kategoriler.length) return TAMAM
  const liste = [...veri.kategoriler]
  ;[liste[i], liste[j]] = [liste[j], liste[i]]
  return kaydet({ ...veri, kategoriler: liste })
}

export function kategoriSil(id: string): Sonuc {
  const adet = veri.urunler.filter((u) => u.kategoriId === id).length
  if (adet) return hata(`Bu kategoride ${adet} ürün var. Önce ürünleri silin ya da başka kategoriye taşıyın.`)
  return kaydet({ ...veri, kategoriler: veri.kategoriler.filter((k) => k.id !== id) })
}

/* ── ürünler (fiyat kuruş cinsinden tam sayı) ── */
export function urunKaydet(u: { id?: string; ad: string; kategoriId: string; fiyat: number; satista: boolean }): Sonuc {
  const ad = duzAd(u.ad)
  if (ad.length < 2 || ad.length > 60) return hata('Ürün adı 2–60 karakter olmalı.')
  if (!veri.kategoriler.some((k) => k.id === u.kategoriId)) return hata('Bir kategori seçin.')
  if (!Number.isInteger(u.fiyat) || u.fiyat < 0 || u.fiyat > EN_YUKSEK_FIYAT) return hata('Geçerli bir fiyat yazın.')
  if (veri.urunler.some((x) => x.id !== u.id && x.kategoriId === u.kategoriId && kucuk(x.ad) === kucuk(ad)))
    return hata('Bu kategoride aynı adda bir ürün zaten var.')
  const kayit: Urun = { id: u.id ?? kimlik(), ad, kategoriId: u.kategoriId, fiyat: u.fiyat, satista: u.satista }
  if (!u.id && veri.urunler.length >= 1000) return hata('En fazla 1000 ürün eklenebilir.')
  const urunler = u.id ? veri.urunler.map((x) => (x.id === u.id ? kayit : x)) : [...veri.urunler, kayit]
  return kaydet({ ...veri, urunler })
}

export const urunSatista = (id: string, satista: boolean) =>
  kaydet({ ...veri, urunler: veri.urunler.map((u) => (u.id === id ? { ...u, satista } : u)) })

export const urunSil = (id: string) => kaydet({ ...veri, urunler: veri.urunler.filter((u) => u.id !== id) })

/* ── personel ── PIN düz yazı olarak saklanmaz; yalnızca özeti tutulur. */
async function pinOzeti(pin: string): Promise<string> {
  const metin = `${veri.tuz}:${pin}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bayt = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin))
    return Array.from(new Uint8Array(bayt), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  /* güvenli bağlam yoksa (eski tarayıcı) basit özet: yine düz yazı saklanmaz */
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < metin.length; i++) {
    const c = metin.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  return `b${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`
}

export async function personelKaydet(p: { id?: string; ad: string; yetkiler: Yetki[]; pin: string; aktif: boolean }): Promise<Sonuc> {
  const ad = duzAd(p.ad)
  const mevcut = p.id ? veri.personel.find((x) => x.id === p.id) : undefined
  if (ad.length < 2 || ad.length > 40) return hata('Ad 2–40 karakter olmalı.')
  if (veri.personel.some((x) => x.id !== p.id && kucuk(x.ad) === kucuk(ad))) return hata('Bu adda bir personel zaten var.')
  const yetkiler = (['kasa', 'mutfak'] as Yetki[]).filter((y) => p.yetkiler.includes(y))
  if (!yetkiler.length) return hata('En az bir ekran seçin.')
  let pinOzet = mevcut?.pinOzet ?? ''
  if (p.pin || !mevcut) {
    if (!/^\d{4}$/.test(p.pin)) return hata('PIN 4 haneli bir sayı olmalı.')
    pinOzet = await pinOzeti(p.pin)
    if (veri.personel.some((x) => x.id !== p.id && x.pinOzet === pinOzet)) return hata('Bu PIN başka bir personelde kullanılıyor. Farklı bir PIN seçin.')
  }
  if (!mevcut && veri.personel.length >= 200) return hata('En fazla 200 personel eklenebilir.')
  const kayit: PersonelKaydi = { id: mevcut?.id ?? kimlik(), ad, yetkiler, pinOzet, aktif: p.aktif }
  const personel = mevcut ? veri.personel.map((x) => (x.id === kayit.id ? kayit : x)) : [...veri.personel, kayit]
  return kaydet({ ...veri, personel })
}

export const personelAktif = (id: string, aktif: boolean) =>
  kaydet({ ...veri, personel: veri.personel.map((p) => (p.id === id ? { ...p, aktif } : p)) })

export const personelSil = (id: string) => kaydet({ ...veri, personel: veri.personel.filter((p) => p.id !== id) })

/** PIN'i ve ekran yetkisini denetler; eşleşen aktif personeli döndürür. */
export async function personelBul(pin: string, yetki: Yetki): Promise<PersonelKaydi | null> {
  const ozet = await pinOzeti(pin)
  return veri.personel.find((p) => p.aktif && p.yetkiler.includes(yetki) && p.pinOzet === ozet) ?? null
}

/* ── örnek menü: boş kurulumda tek dokunuşla denemek için ── */
const ORNEK: [string, [string, number][]][] = [
  ['Dürümler', [['Tavuk Dürüm', 18000], ['Köfte Dürüm', 22000], ['Et Dürüm', 26000]]],
  ['Tostlar', [['Kaşarlı Tost', 11000], ['Karışık Tost', 14000], ['Ayvalık Tostu', 19000]]],
  ['İçecekler', [['Su', 1500], ['Çay', 2000], ['Ayran', 3500], ['Kola', 6000]]],
  ['Tatlılar', [['Sütlaç', 9500], ['Künefe', 17000]]],
]

export function ornekMenuYukle(): Sonuc {
  if (veri.kategoriler.length || veri.urunler.length) return hata('Örnek menü yalnızca boş menüye yüklenebilir.')
  const kategoriler: Kategori[] = []
  const urunler: Urun[] = []
  for (const [kAd, liste] of ORNEK) {
    const k = { id: kimlik(), ad: kAd }
    kategoriler.push(k)
    for (const [ad, fiyat] of liste) urunler.push({ id: kimlik(), kategoriId: k.id, ad, fiyat, satista: true })
  }
  return kaydet({ ...veri, kategoriler, urunler })
}

/* ── okuma ── */
function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useIsletme = () => useSyncExternalStore(abone, () => veri.isletme)
export const useKategoriler = () => useSyncExternalStore(abone, () => veri.kategoriler)
export const useUrunler = () => useSyncExternalStore(abone, () => veri.urunler)
export const usePersonelListesi = () => useSyncExternalStore(abone, () => veri.personel)
