/* Oturum katmanı.
   ŞU AN: önizleme. Sunucu (Supabase) bağlanana kadar yönetici girişi yalnızca biçim olarak denetlenir ve
   ekranlarda "Önizleme" etiketi görünür. Personel PIN'i ise Yönetim'de tanımlanan personele göre gerçekten denetlenir.
   Cihaz kasa/mutfak/TV ekranına geçtiğinde yönetici bölümleri kilitlenir; geri dönmek için giriş şifresi sorulur.
   Bu denetimlerin hepsi tarayıcıda yapılır: tarayıcı kayıtlarına erişebilen biri aşabilir. Gerçek koruma sunucuyla gelir.
   Sunucu bağlanınca bu dosyadaki girisYap / pinDogrula / cikis sunucuya taşınır; ekranlar değişmez. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { ozetle, personelBul, usePersonelListesi, type Sonuc, type Yetki } from './veri'

export const ONIZLEME = true

export type Ekran = 'kasa' | 'mutfak' | 'tv' | 'yonetim'
export const EKRANLAR: Ekran[] = ['kasa', 'mutfak', 'tv', 'yonetim']
export const PIN_ISTEYEN: Ekran[] = ['kasa', 'mutfak']
export const EKRAN_ADI: Record<Ekran, string> = {
  kasa: 'Kasa',
  mutfak: 'Mutfak',
  tv: 'TV ekranı',
  yonetim: 'Yönetim',
}

/** Kasa ve mutfak önce personel PIN'i ister; TV ve yönetim doğrudan açılır. */
export const ekranYolu = (e: Ekran) => (PIN_ISTEYEN.includes(e) ? `/pin/${e}` : `/${e}`)

type Durum = { eposta: string; sifreOzet: string } | null
type Personel = { id: string; ad: string; ekran: Ekran } | null
type Kilit = { hata: number; bitis: number }

const A_OTURUM = 'sr-oturum'
const A_CIHAZ = 'sr-cihaz'
const A_PERSONEL = 'sr-personel'
const A_YONETICI = 'sr-yonetici-acik'
const A_KILIT = 'sr-pin-kilit'
const A_YKILIT = 'sr-yonetici-kilit'
const HATA_SINIRI = 5
const KILIT_SURESI = 30_000
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

function oturumOku(): Durum {
  const o = oku<Partial<NonNullable<Durum>>>('local', A_OTURUM)
  return o && typeof o.eposta === 'string' && typeof o.sifreOzet === 'string' && o.sifreOzet.length >= 16 ? { eposta: o.eposta, sifreOzet: o.sifreOzet } : null
}
function cihazOku(): Ekran | null {
  const c = oku<string>('local', A_CIHAZ)
  return EKRANLAR.includes(c as Ekran) ? (c as Ekran) : null
}

let oturum: Durum = oturumOku()
let cihaz: Ekran | null = cihazOku()
let personel: Personel = oku<Personel>('session', A_PERSONEL)
/* yönetici bölümleri yalnızca bu sekmede, giriş ya da şifre doğrulamasından sonra açıktır */
let yoneticiAcik = oturum !== null && oku<boolean>('session', A_YONETICI) === true

/* başka sekmede çıkış yapılırsa ya da cihazın ekranı değişirse bu sekme de güncellenir */
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== A_OTURUM && e.key !== A_CIHAZ) return
    oturum = oturumOku()
    cihaz = cihazOku()
    if (!oturum) {
      personel = null
      yoneticiAcik = false
    }
    duyur()
  })

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Art arda 5 hatalı denemeden sonra 30 saniye bekletir. */
function denemeKilidi(anahtar: string) {
  const kilit = oku<Kilit>('local', anahtar) ?? { hata: 0, bitis: 0 }
  const simdi = Date.now()
  return {
    engel: kilit.bitis > simdi ? `Çok fazla hatalı deneme. ${Math.ceil((kilit.bitis - simdi) / 1000)} saniye sonra tekrar deneyin.` : '',
    hatali(mesaj: string): string {
      const sayi = kilit.hata + 1
      if (sayi >= HATA_SINIRI) {
        yaz('local', anahtar, { hata: 0, bitis: simdi + KILIT_SURESI })
        return 'Çok fazla hatalı deneme. 30 saniye sonra tekrar deneyin.'
      }
      yaz('local', anahtar, { hata: sayi, bitis: 0 })
      return `${mesaj} Kalan deneme: ${HATA_SINIRI - sayi}`
    },
    temizle: () => yaz('local', anahtar, null),
  }
}

function yoneticiAyarla(acik: boolean) {
  yoneticiAcik = acik
  yaz('session', A_YONETICI, acik ? true : null)
}

export async function girisYap(eposta: string, sifre: string): Promise<Sonuc> {
  const e = eposta.trim().toLowerCase()
  if (!EPOSTA.test(e) || e.length > 254) return { tamam: false, hata: 'Geçerli bir e-posta adresi yazın.' }
  if (sifre.length < 8 || sifre.length > 128) return { tamam: false, hata: 'Şifre en az 8 karakter olmalı.' }
  oturum = { eposta: e, sifreOzet: await ozetle(`yonetici:${sifre}`) }
  yaz('local', A_OTURUM, oturum)
  yoneticiAyarla(true)
  duyur()
  return { tamam: true }
}

/** Kilitli cihazda yönetici bölümlerini açar: girişte kullanılan şifre sorulur. */
export async function yoneticiDogrula(sifre: string): Promise<Sonuc> {
  if (!oturum) return { tamam: false, hata: 'Oturum kapalı. Yeniden giriş yapın.' }
  const kilit = denemeKilidi(A_YKILIT)
  if (kilit.engel) return { tamam: false, hata: kilit.engel }
  if (sifre.length < 8 || sifre.length > 128 || (await ozetle(`yonetici:${sifre}`)) !== oturum.sifreOzet)
    return { tamam: false, hata: kilit.hatali('Şifre hatalı.') }
  kilit.temizle()
  yoneticiAyarla(true)
  duyur()
  return { tamam: true }
}

/** Cihaz kasa / mutfak / TV ekranına geçtiğinde çağrılır: yönetici bölümleri yeniden şifre ister. */
export function cihazKilitle() {
  if (!yoneticiAcik) return
  yoneticiAyarla(false)
  duyur()
}

/** Personel PIN'i: art arda 5 hatalı denemeden sonra bu cihazda 30 saniye kilitlenir. */
export async function pinDogrula(pin: string, ekran: Yetki): Promise<Sonuc> {
  if (!/^\d{4}$/.test(pin)) return { tamam: false, hata: 'PIN 4 haneli olmalı.' }
  const kilit = denemeKilidi(A_KILIT)
  if (kilit.engel) return { tamam: false, hata: kilit.engel }
  const kisi = await personelBul(pin, ekran)
  if (!kisi) return { tamam: false, hata: kilit.hatali('PIN hatalı.') }
  kilit.temizle()
  personel = { id: kisi.id, ad: kisi.ad, ekran }
  yaz('session', A_PERSONEL, personel)
  duyur()
  return { tamam: true }
}

export function cihazSec(e: Ekran | null) {
  cihaz = e
  yaz('local', A_CIHAZ, e)
  duyur()
}

export function personelCikis() {
  personel = null
  yaz('session', A_PERSONEL, null)
  duyur()
}

export function cikis() {
  oturum = null
  personel = null
  yaz('local', A_OTURUM, null)
  yaz('session', A_PERSONEL, null)
  yoneticiAyarla(false)
  duyur()
}

function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useOturum = () => useSyncExternalStore(abone, () => oturum)
export const useCihaz = () => useSyncExternalStore(abone, () => cihaz)
export const useYoneticiAcik = () => useSyncExternalStore(abone, () => yoneticiAcik)
const usePersonel = () => useSyncExternalStore(abone, () => personel)

/** Bu ekranda oturumu açık personel. Yönetim'de silinmiş, girişi kapatılmış ya da yetkisi alınmışsa null döner. */
export function useGecerliPersonel(ekran: Yetki) {
  const p = usePersonel()
  const liste = usePersonelListesi()
  if (!p || p.ekran !== ekran) return null
  const kayit = liste.find((k) => k.id === p.id)
  return kayit && kayit.aktif && kayit.yetkiler.includes(ekran) ? { ...p, ad: kayit.ad } : null
}
