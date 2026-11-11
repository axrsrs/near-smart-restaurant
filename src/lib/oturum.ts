/* Oturum katmanı.
   ŞU AN: önizleme. Sunucu (Supabase) bağlanana kadar yönetici girişi yalnızca biçim olarak denetlenir ve
   ekranlarda "Önizleme" etiketi görünür. Personel PIN'i ise Yönetim'de tanımlanan personele göre gerçekten denetlenir.
   Sunucu bağlanınca bu dosyadaki girisYap / pinDogrula / cikis sunucuya taşınır; ekranlar değişmez. */
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { personelBul, type Sonuc, type Yetki } from './veri'

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

type Durum = { eposta: string } | null
type Personel = { id: string; ad: string; ekran: Ekran } | null
type Kilit = { hata: number; bitis: number }

const A_OTURUM = 'sr-oturum'
const A_CIHAZ = 'sr-cihaz'
const A_PERSONEL = 'sr-personel'
const A_KILIT = 'sr-pin-kilit'
const HATA_SINIRI = 5
const KILIT_SURESI = 30_000
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

let oturum: Durum = oku<Durum>('local', A_OTURUM)
let cihaz: Ekran | null = (() => {
  const c = oku<string>('local', A_CIHAZ)
  return EKRANLAR.includes(c as Ekran) ? (c as Ekran) : null
})()
let personel: Personel = oku<Personel>('session', A_PERSONEL)

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function girisYap(eposta: string, sifre: string): Promise<Sonuc> {
  const e = eposta.trim().toLowerCase()
  if (!EPOSTA.test(e) || e.length > 254) return { tamam: false, hata: 'Geçerli bir e-posta adresi yazın.' }
  if (sifre.length < 8 || sifre.length > 128) return { tamam: false, hata: 'Şifre en az 8 karakter olmalı.' }
  oturum = { eposta: e }
  yaz('local', A_OTURUM, oturum)
  duyur()
  return { tamam: true }
}

/** Personel PIN'i: art arda 5 hatalı denemeden sonra bu cihazda 30 saniye kilitlenir. */
export async function pinDogrula(pin: string, ekran: Yetki): Promise<Sonuc> {
  if (!/^\d{4}$/.test(pin)) return { tamam: false, hata: 'PIN 4 haneli olmalı.' }
  const kilit = oku<Kilit>('local', A_KILIT) ?? { hata: 0, bitis: 0 }
  const simdi = Date.now()
  if (kilit.bitis > simdi)
    return { tamam: false, hata: `Çok fazla hatalı deneme. ${Math.ceil((kilit.bitis - simdi) / 1000)} saniye sonra tekrar deneyin.` }
  const kisi = await personelBul(pin, ekran)
  if (!kisi) {
    const sayi = kilit.hata + 1
    if (sayi >= HATA_SINIRI) {
      yaz('local', A_KILIT, { hata: 0, bitis: simdi + KILIT_SURESI })
      return { tamam: false, hata: 'Çok fazla hatalı deneme. 30 saniye sonra tekrar deneyin.' }
    }
    yaz('local', A_KILIT, { hata: sayi, bitis: 0 })
    return { tamam: false, hata: `PIN hatalı. Kalan deneme: ${HATA_SINIRI - sayi}` }
  }
  yaz('local', A_KILIT, null)
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
export const usePersonel = () => useSyncExternalStore(abone, () => personel)
