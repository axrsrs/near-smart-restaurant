/* Tetra'dan hızlı menü düzenleme. Aynı NearMenu kaydı değişir: QR menüde ve kasada birlikte görünür.
   Yetkiyi veritabanı denetler (yalnızca işletmenin üyeleri yazabilir). Fotoğraf, açıklama ve ayrıntılar NearMenu panelinde kalır.
   Çeviri yalnızca adı değişen ya da yeni eklenen kayıt için istenir (NearMenu'nün çeviri servisi); alınamazsa ad Türkçe kalır. */
import { menuYukle } from './menu'
import type { Sonuc } from './oturum'
import { sunucu } from './sunucu'

const duz = (s: string) => s.trim().replace(/\s+/g, ' ')
const HATA = 'Kaydedilemedi. Bağlantını denetleyip yeniden dene.'

async function cevir(metin: string): Promise<Record<string, string>> {
  const adlar: Record<string, string> = { tr: metin }
  try {
    const { data } = await sunucu.auth.getSession()
    const jeton = data.session?.access_token
    if (!jeton) return adlar
    await Promise.all(
      (['en', 'ar'] as const).map(async (dil) => {
        const y = await fetch('/ceviri', { method: 'POST', headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: metin, target: dil }) })
        if (!y.ok) return
        const j = (await y.json()) as { text?: unknown }
        if (typeof j.text === 'string' && j.text.trim()) adlar[dil] = j.text.trim().slice(0, 200)
      }),
    )
  } catch {
    /* çeviri alınamadı: QR menü bu kayıt için Türkçe adı gösterir */
  }
  return adlar
}

async function bitir(slug: string, hata: unknown): Promise<Sonuc> {
  if (hata) return { tamam: false, hata: HATA }
  await menuYukle(slug, true)
  return { tamam: true }
}
const adDenetle = (ad: string, enCok: number, ne: string): string | null => (ad.length < 2 || ad.length > enCok ? `${ne} 2–${enCok} karakter olmalı.` : null)

export async function urunEkle(slug: string, isletme: string, u: { ad: string; kategoriId: string; fiyat: number; sira: number }): Promise<Sonuc> {
  const ad = duz(u.ad)
  const h = adDenetle(ad, 60, 'Ürün adı')
  if (h) return { tamam: false, hata: h }
  const { error } = await sunucu.from('products').insert({ restaurant_id: isletme, category_id: u.kategoriId, name: ad, names: await cevir(ad), price: u.fiyat / 100, sort: u.sira })
  return bitir(slug, error)
}

/** Yalnızca değişen alanlar gönderilir; çeviri yalnızca ad değiştiyse istenir. */
export async function urunGuncelle(slug: string, id: string, eski: { ad: string; fiyat: number; kategoriId: string }, yeni: { ad: string; fiyat: number; kategoriId: string }): Promise<Sonuc> {
  const ad = duz(yeni.ad)
  const h = adDenetle(ad, 60, 'Ürün adı')
  if (h) return { tamam: false, hata: h }
  const degisen: Record<string, unknown> = {}
  if (ad !== eski.ad) {
    degisen.name = ad
    degisen.names = await cevir(ad)
  }
  if (yeni.fiyat !== eski.fiyat) degisen.price = yeni.fiyat / 100
  if (yeni.kategoriId !== eski.kategoriId) degisen.category_id = yeni.kategoriId
  if (!Object.keys(degisen).length) return { tamam: true }
  const { error } = await sunucu.from('products').update(degisen).eq('id', id)
  return bitir(slug, error)
}

export async function urunTukendi(slug: string, id: string, tukendi: boolean): Promise<Sonuc> {
  const { error } = await sunucu.from('products').update({ sold: tukendi }).eq('id', id)
  return bitir(slug, error)
}

export async function urunSil(slug: string, id: string): Promise<Sonuc> {
  const { error } = await sunucu.from('products').delete().eq('id', id)
  return bitir(slug, error)
}

export async function kategoriEkle(slug: string, isletme: string, adHam: string, sira: number): Promise<Sonuc & { id?: string }> {
  const ad = duz(adHam)
  const h = adDenetle(ad, 40, 'Kategori adı')
  if (h) return { tamam: false, hata: h }
  const { data, error } = await sunucu.from('categories').insert({ restaurant_id: isletme, name: ad, names: await cevir(ad), sort: sira }).select('id').single()
  const s = await bitir(slug, error)
  return s.tamam ? { tamam: true, id: (data as { id: string } | null)?.id } : s
}

export async function kategoriAdDegistir(slug: string, id: string, adHam: string): Promise<Sonuc> {
  const ad = duz(adHam)
  const h = adDenetle(ad, 40, 'Kategori adı')
  if (h) return { tamam: false, hata: h }
  const { error } = await sunucu.from('categories').update({ name: ad, names: await cevir(ad) }).eq('id', id)
  return bitir(slug, error)
}
