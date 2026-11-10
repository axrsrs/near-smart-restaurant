/* Oturum katmanı.
   ŞU AN: önizleme. Sunucu (Supabase) bağlanana kadar giriş ve PIN yalnızca biçim olarak denetlenir,
   hiçbir veri korunmaz ve ekranlarda "Önizleme" etiketi görünür.
   1. aşamada bu dosyadaki girisYap / pinDogrula / cikis sunucuya bağlanır; ekranlar değişmez. */
import { useSyncExternalStore } from 'react'

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

export type Isletme = { ad: string; sube: string; logo: string | null }
type Durum = { eposta: string; isletme: Isletme } | null
type Personel = { ad: string; ekran: Ekran } | null

const A_OTURUM = 'sr-oturum'
const A_CIHAZ = 'sr-cihaz'
const A_PERSONEL = 'sr-personel'
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

/* Depolama kapalıysa (gizli sekme, kısıtlı tarayıcı) erişimin kendisi hata verir; durum o zaman yalnızca bellekte kalır. */
type Depo = 'local' | 'session'
function depo(tur: Depo): Storage | null {
  try {
    return tur === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}
function oku<T>(tur: Depo, anahtar: string): T | null {
  try {
    const v = depo(tur)?.getItem(anahtar)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
function yaz(tur: Depo, anahtar: string, deger: unknown) {
  try {
    if (deger === null) depo(tur)?.removeItem(anahtar)
    else depo(tur)?.setItem(anahtar, JSON.stringify(deger))
  } catch {
    /* kota dolu ya da depolama kapalı */
  }
}

let oturum: Durum = oku<Durum>('local', A_OTURUM)
let cihaz: Ekran | null = (() => {
  const c = oku<string>('local', A_CIHAZ)
  return EKRANLAR.includes(c as Ekran) ? (c as Ekran) : null
})()
let personel: Personel = oku<Personel>('session', A_PERSONEL)

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type Sonuc = { tamam: true } | { tamam: false; hata: string }

export async function girisYap(eposta: string, sifre: string): Promise<Sonuc> {
  const e = eposta.trim().toLowerCase()
  if (!EPOSTA.test(e) || e.length > 254) return { tamam: false, hata: 'Geçerli bir e-posta adresi yazın.' }
  if (sifre.length < 8 || sifre.length > 128) return { tamam: false, hata: 'Şifre en az 8 karakter olmalı.' }
  oturum = { eposta: e, isletme: { ad: 'Örnek İşletme', sube: 'Merkez şube', logo: null } }
  yaz('local', A_OTURUM, oturum)
  duyur()
  return { tamam: true }
}

export async function pinDogrula(pin: string, ekran: Ekran): Promise<Sonuc> {
  if (!/^\d{4}$/.test(pin)) return { tamam: false, hata: 'PIN 4 haneli olmalı.' }
  personel = { ad: 'Önizleme personeli', ekran }
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
