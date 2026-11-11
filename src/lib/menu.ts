/* Ürünler, fiyatlar ve fotoğraflar NearMenu'den canlı okunur (tek ürün listesi).
   Son başarılı menü cihazda saklanır: bağlantı koptuğunda kasa son bilinen menüyle çalışmaya devam eder. */
import { useEffect, useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { rpc } from './sunucu'

export type MenuUrun = { id: string; ad: string; aciklama: string; fiyat: number; gorsel: string; tukendi: boolean }
export type MenuKategori = { id: string; ad: string; urunler: MenuUrun[] }
export type Menu = { slug: string; isletme: { id: string; ad: string; logo: string }; kategoriler: MenuKategori[]; alindi: number }
export type MenuDurumu = { slug: string; menu: Menu | null; yukleniyor: boolean; hata: string }

type HamUrun = { id?: unknown; name?: unknown; description?: unknown; price?: unknown; image?: unknown; sold?: unknown }
type HamKategori = { id?: unknown; name?: unknown; items?: unknown }
type HamMenu = { restaurant?: { id?: unknown; name?: unknown; logo?: unknown }; categories?: unknown } | null

const YENILEME_ARALIGI = 120_000
const yazi = (v: unknown, enCok: number) => (typeof v === 'string' ? v.trim().slice(0, enCok) : '')
const guvenliGorsel = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : '')

function cevir(slug: string, ham: HamMenu): Menu | null {
  if (!ham || !ham.restaurant || !Array.isArray(ham.categories)) return null
  const kategoriler: MenuKategori[] = []
  for (const k of ham.categories as HamKategori[]) {
    if (!k || typeof k.id !== 'string' || !Array.isArray(k.items)) continue
    const urunler: MenuUrun[] = []
    for (const u of k.items as HamUrun[]) {
      const fiyat = Math.round(Number(u?.price) * 100)
      if (!u || typeof u.id !== 'string' || !Number.isFinite(fiyat) || fiyat < 0) continue
      urunler.push({ id: u.id, ad: yazi(u.name, 120), aciklama: yazi(u.description, 300), fiyat, gorsel: guvenliGorsel(u.image), tukendi: u.sold === true })
    }
    if (urunler.length) kategoriler.push({ id: k.id, ad: yazi(k.name, 80), urunler })
  }
  return {
    slug,
    isletme: { id: yazi(ham.restaurant.id, 64), ad: yazi(ham.restaurant.name, 120), logo: guvenliGorsel(ham.restaurant.logo) },
    kategoriler,
    alindi: Date.now(),
  }
}

let durum: MenuDurumu = { slug: '', menu: null, yukleniyor: false, hata: '' }
const dinleyenler = new Set<() => void>()
const ayarla = (d: MenuDurumu) => {
  durum = d
  dinleyenler.forEach((f) => f())
}

export async function menuYukle(slug: string, zorla = false): Promise<void> {
  if (!slug) return
  if (durum.slug !== slug) ayarla({ slug, menu: oku<Menu>('local', `sr-menu:${slug}`), yukleniyor: false, hata: '' })
  if (durum.yukleniyor) return
  if (!zorla && durum.menu && Date.now() - durum.menu.alindi < YENILEME_ARALIGI) return
  ayarla({ ...durum, yukleniyor: true })
  try {
    const menu = cevir(slug, await rpc<HamMenu>('get_menu', { p_slug: slug }))
    if (durum.slug !== slug) return
    if (!menu) return ayarla({ ...durum, yukleniyor: false, hata: 'Bu adreste yayında bir NearMenu işletmesi bulunamadı.' })
    yaz('local', `sr-menu:${slug}`, menu)
    ayarla({ slug, menu, yukleniyor: false, hata: '' })
  } catch {
    if (durum.slug !== slug) return
    ayarla({ ...durum, yukleniyor: false, hata: durum.menu ? 'Bağlantı yok: son bilinen menü gösteriliyor.' : 'Menü yüklenemedi. İnternet bağlantısını denetleyin.' })
  }
}

function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}

/** Menüyü okur; ekran açıkken iki dakikada bir ve ekrana geri dönüldüğünde tazeler. */
export function useMenu(slug: string): MenuDurumu {
  const d = useSyncExternalStore(abone, () => durum)
  useEffect(() => {
    menuYukle(slug)
    const tazele = () => {
      if (!document.hidden) menuYukle(slug)
    }
    const sayac = setInterval(tazele, YENILEME_ARALIGI)
    document.addEventListener('visibilitychange', tazele)
    window.addEventListener('online', tazele)
    return () => {
      clearInterval(sayac)
      document.removeEventListener('visibilitychange', tazele)
      window.removeEventListener('online', tazele)
    }
  }, [slug])
  return d.slug === slug ? d : { slug, menu: null, yukleniyor: true, hata: '' }
}
