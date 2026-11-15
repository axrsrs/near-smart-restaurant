/* Ürün seçenekleri: boy, ekstralar, çıkarılacaklar.
   İşletme sahibi seçenek gruplarını Yönetim › Menü › Seçenek grupları'ndan tanımlar ve ürünlere bağlar.
   Kasa açık seçenekleri okur; seçim kuralları burada da denetlenir ama asıl doğrulama ve fiyatlama sunucudadır. */
import { useSyncExternalStore } from 'react'
import { cihazCagir, type Sonuc } from './oturum'
import { cagir, hataMetni } from './sunucu'

export type Secenek = { id: string; ad: string; fiyat: number; varsayilan: boolean; aktif: boolean } // fiyat: kuruş, ürün fiyatına eklenir
export type SecenekGrup = { id: string; ad: string; tur: 'tek' | 'coklu'; zorunlu: boolean; en_fazla: number | null; secenekler: Secenek[] }
export type SecenekVeri = { gruplar: SecenekGrup[]; urunler: Record<string, string[]> }
/** Sepette ve siparişte tutulan seçim. */
export type Secim = { id: string; grup: string; ad: string; fiyat: number }

const BOS: SecenekVeri = { gruplar: [], urunler: {} }

/** Ürüne bağlı gruplar (sıralı). */
export function urunGruplari(v: SecenekVeri, urunId: string): SecenekGrup[] {
  const ids = v.urunler[urunId] ?? []
  const harita = new Map(v.gruplar.map((g) => [g.id, g]))
  return ids.map((id) => harita.get(id)).filter((g): g is SecenekGrup => Boolean(g && g.secenekler.length))
}

/** Seçim kurallara uyuyor mu; uymuyorsa ilk hatanın metni. */
export function secimHatasi(gruplar: SecenekGrup[], secili: Set<string>): string | null {
  for (const g of gruplar) {
    const n = g.secenekler.filter((s) => secili.has(s.id)).length
    if (g.zorunlu && n === 0) return `${g.ad} seçin.`
    if (g.tur === 'tek' && n > 1) return `${g.ad} için yalnızca bir seçenek seçilebilir.`
    if (g.en_fazla && n > g.en_fazla) return `${g.ad} için en fazla ${g.en_fazla} seçenek seçilebilir.`
  }
  return null
}

/** Varsayılan seçim: tek seçimli zorunlu grupta varsayılan (yoksa ilk) seçenek, diğerlerinde işaretli varsayılanlar. */
export function varsayilanSecim(gruplar: SecenekGrup[]): Set<string> {
  const s = new Set<string>()
  for (const g of gruplar) {
    const v = g.secenekler.filter((x) => x.varsayilan)
    if (g.tur === 'tek') {
      const ilk = v[0] ?? (g.zorunlu ? g.secenekler[0] : undefined)
      if (ilk) s.add(ilk.id)
    } else v.forEach((x) => s.add(x.id))
  }
  return s
}

/** Seçili kimliklerden sepet seçimleri (grup sırasıyla). */
export function secimler(gruplar: SecenekGrup[], secili: Set<string>): Secim[] {
  return gruplar.flatMap((g) => g.secenekler.filter((s) => secili.has(s.id)).map((s) => ({ id: s.id, grup: g.ad, ad: s.ad, fiyat: s.fiyat })))
}

/** Seçimin kısa yazısı: "Büyük · Ekstra peynir · Soğansız" */
export const secimYazisi = (l: { ad: string }[]) => l.map((s) => s.ad).join(' · ')

/* ───────── kasa: açık seçenekler (cihaz anahtarı + personel oturumu) ───────── */
let kasaVeri: SecenekVeri = BOS
const dinleyenler = new Set<() => void>()
export async function kasaSecenekYukle(): Promise<void> {
  try {
    kasaVeri = (await cihazCagir<SecenekVeri>('tetra_kasa_secenekler')) ?? BOS
  } catch {
    /* seçenekler okunamazsa ürünler seçeneksiz satılır; sunucu zorunlu seçimi yine denetler */
  }
  dinleyenler.forEach((f) => f())
}
const abone = (f: () => void) => {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useKasaSecenek = () => useSyncExternalStore(abone, () => kasaVeri)

/* ───────── yönetim (işletme sahibi) ───────── */
export type GrupTaslak = { id?: string; ad: string; tur: 'tek' | 'coklu'; zorunlu: boolean; en_fazla: number | null; secenekler: (Omit<Secenek, 'id'> & { id?: string })[]; urunler: string[] }
export const secenekListe = (isletme: string) => cagir<SecenekVeri>('tetra_secenek_liste', { p_restaurant: isletme })
export async function grupKaydet(isletme: string, g: GrupTaslak): Promise<Sonuc & { id?: string }> {
  try {
    const y = await cagir<{ tamam: boolean; hata?: string; id?: string }>('tetra_secenek_grup_kaydet', { p_restaurant: isletme, p_grup: g })
    return y.tamam ? { tamam: true, id: y.id } : { tamam: false, hata: y.hata ?? 'Grup kaydedilemedi.' }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}
export async function grupSil(isletme: string, id: string): Promise<Sonuc> {
  try {
    await cagir('tetra_secenek_grup_sil', { p_restaurant: isletme, p_id: id })
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}
