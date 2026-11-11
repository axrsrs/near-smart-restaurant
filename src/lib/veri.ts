/* Veri katmanı: NearMenu bağlantısı, personel, siparişler, kasadan işaretlenen "tükendi" ürünler.
   ŞU AN: veriler bu cihazın tarayıcısında saklanır (sr-veri). Sunucu bağlanınca yalnızca bu dosyanın
   içi değişir; ekranlar aynı işlevleri çağırmaya devam eder. Tüm girdiler burada denetlenir.
   Ürünler burada tutulmaz: NearMenu'den okunur (src/lib/menu.ts). */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { EN_YUKSEK_FIYAT } from './para'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }
export type Yetki = 'kasa' | 'mutfak'
export type PersonelKaydi = { id: string; ad: string; yetkiler: Yetki[]; pinOzet: string; aktif: boolean }
export type SiparisTuru = 'burada' | 'paket'
export type Odeme = 'nakit' | 'kart'
export type SiparisDurumu = 'hazirlaniyor' | 'hazir' | 'teslim' | 'iptal'
export type Kalem = { urunId: string; ad: string; fiyat: number; adet: number; not: string }
export type Siparis = {
  id: string
  kod: string // müşteri takip adresi için tahmin edilemez kod
  no: number // her gün 1'den başlar
  gun: string // YYYY-AA-GG (cihazın yerel günü)
  zaman: number
  kalemler: Kalem[]
  toplam: number
  tur: SiparisTuru
  odeme: Odeme
  personelAd: string
  durum: SiparisDurumu
}
type Veri = { surum: 2; tuz: string; slug: string; personel: PersonelKaydi[]; tukendi: string[]; siparisler: Siparis[]; otomatikFis: boolean }

const ANAHTAR = 'sr-veri'
const VARSAYILAN_SLUG = 'nearmenu-demo'
const SAKLAMA_GUNU = 7
const kimlik = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const bos = (): Veri => ({ surum: 2, tuz: kimlik(), slug: VARSAYILAN_SLUG, personel: [], tukendi: [], siparisler: [], otomatikFis: true })

function yukle(): Veri {
  const v = oku<Partial<Veri> & { surum?: number }>('local', ANAHTAR)
  if (!v || typeof v.tuz !== 'string' || !Array.isArray(v.personel)) return bos()
  /* sürüm 1 (cihazda ürün tutulan dönem): personel ve PIN'ler korunur, yerel ürünler bırakılır */
  return {
    ...bos(),
    tuz: v.tuz,
    personel: v.personel,
    slug: typeof v.slug === 'string' && v.slug ? v.slug : VARSAYILAN_SLUG,
    tukendi: Array.isArray(v.tukendi) ? v.tukendi : [],
    siparisler: Array.isArray(v.siparisler) ? v.siparisler : [],
    otomatikFis: v.otomatikFis !== false,
  }
}

let veri = yukle()
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

const TAMAM: Sonuc = { tamam: true }
const hata = (h: string): Sonuc => ({ tamam: false, hata: h })

/** Yeni durumu kaydeder. Tarayıcı yazmayı reddederse (kota) değişiklik uygulanmaz. */
function kaydet(yeni: Veri): Sonuc {
  const yazildi = yaz('local', ANAHTAR, yeni)
  if (!yazildi && oku('local', ANAHTAR) !== null) return hata('Kaydedilemedi: tarayıcının depolama alanı dolu.')
  veri = yeni
  duyur()
  return TAMAM
}

/* aynı tarayıcıdaki diğer sekmeler (ör. kasa ve mutfak yan yana) değişikliği anında görür */
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== ANAHTAR) return
    veri = yukle()
    duyur()
  })

const kucuk = (s: string) => s.trim().toLocaleLowerCase('tr')
const duzAd = (s: string) => s.trim().replace(/\s+/g, ' ')

/* ── NearMenu bağlantısı ── */
export function slugKaydet(ham: string): Sonuc {
  const slug = ham.trim().toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60)
    return hata('Adres 3–60 karakter olmalı; yalnızca küçük harf, rakam ve tire içerebilir.')
  return kaydet({ ...veri, slug })
}

/* ── tükendi: kasadan işaretlenir ── */
export function tukendiAyarla(urunId: string, tukendi: boolean): Sonuc {
  const kume = new Set(veri.tukendi)
  if (tukendi) kume.add(urunId)
  else kume.delete(urunId)
  return kaydet({ ...veri, tukendi: [...kume].slice(-2000) })
}

/* ── siparişler ── */
export const bugun = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`

function takipKodu(): string {
  const b = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function siparisOlustur(s: { kalemler: Kalem[]; tur: SiparisTuru; odeme: Odeme; personelAd: string }): Sonuc & { siparis?: Siparis } {
  if (!s.kalemler.length) return hata('Sepet boş.')
  if (s.kalemler.length > 100) return hata('Bir siparişte en fazla 100 satır olabilir.')
  if (s.tur !== 'burada' && s.tur !== 'paket') return hata('Sipariş türünü seçin.')
  if (s.odeme !== 'nakit' && s.odeme !== 'kart') return hata('Ödeme türünü seçin.')
  const kalemler: Kalem[] = []
  for (const k of s.kalemler) {
    if (!k.urunId || !Number.isInteger(k.adet) || k.adet < 1 || k.adet > 99) return hata('Adet 1–99 arasında olmalı.')
    if (!Number.isInteger(k.fiyat) || k.fiyat < 0 || k.fiyat > EN_YUKSEK_FIYAT) return hata('Ürün fiyatı geçersiz.')
    kalemler.push({ urunId: k.urunId, ad: duzAd(k.ad).slice(0, 120), fiyat: k.fiyat, adet: k.adet, not: duzAd(k.not).slice(0, 80) })
  }
  const simdi = new Date()
  const gun = bugun(simdi)
  const no = veri.siparisler.reduce((m, x) => (x.gun === gun && x.no > m ? x.no : m), 0) + 1
  const siparis: Siparis = {
    id: kimlik(),
    kod: takipKodu(),
    no,
    gun,
    zaman: simdi.getTime(),
    kalemler,
    toplam: kalemler.reduce((t, k) => t + k.fiyat * k.adet, 0),
    tur: s.tur,
    odeme: s.odeme,
    personelAd: duzAd(s.personelAd).slice(0, 40),
    durum: 'hazirlaniyor',
  }
  const sinir = simdi.getTime() - SAKLAMA_GUNU * 86_400_000
  const sonuc = kaydet({ ...veri, siparisler: [...veri.siparisler.filter((x) => x.zaman >= sinir), siparis] })
  return sonuc.tamam ? { tamam: true, siparis } : sonuc
}

export const siparisDurumu = (id: string, durum: SiparisDurumu) =>
  kaydet({ ...veri, siparisler: veri.siparisler.map((x) => (x.id === id ? { ...x, durum } : x)) })

export const otomatikFisAyarla = (acik: boolean) => kaydet({ ...veri, otomatikFis: acik })

/* ── personel ── PIN düz yazı olarak saklanmaz; yalnızca özeti tutulur. */
/** Cihaza özgü tuzla özet üretir; PIN ve yönetici şifresi düz yazı olarak saklanmaz. */
export async function ozetle(deger: string): Promise<string> {
  const metin = `${veri.tuz}:${deger}`
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
    pinOzet = await ozetle(p.pin)
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
  const ozet = await ozetle(pin)
  return veri.personel.find((p) => p.aktif && p.yetkiler.includes(yetki) && p.pinOzet === ozet) ?? null
}

/* ── okuma ── */
function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useSlug = () => useSyncExternalStore(abone, () => veri.slug)
export const usePersonelListesi = () => useSyncExternalStore(abone, () => veri.personel)
export const useTukendi = () => useSyncExternalStore(abone, () => veri.tukendi)
export const useSiparisler = () => useSyncExternalStore(abone, () => veri.siparisler)
export const useOtomatikFis = () => useSyncExternalStore(abone, () => veri.otomatikFis)
