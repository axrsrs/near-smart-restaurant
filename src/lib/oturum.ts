/* Oturum katmanı. İki ayrı kimlik vardır:
   · Yönetici: işletme sahibi e-posta ve şifreyle girer (Supabase Auth). Personeli ve cihazları yönetir.
   · Cihaz: kasa / mutfak / TV olarak tanıtılan tablet. Kendi anahtarıyla çalışır; yönetici oturumunu taşımaz.
     Kasa ve mutfakta personel 4 haneli PIN ile oturum açar; PIN ve deneme sınırı sunucuda denetlenir. */
import { dogrulamaAl } from './dogrula'
import { useSyncExternalStore } from 'react'
import { oku, yaz } from './depo'
import { cagir, hataMetni, sunucu, SunucuHatasi } from './sunucu'
import { gecerli, gorunumUygula, type Gorunum } from './gorunum'

export type Sonuc = { tamam: true } | { tamam: false; hata: string }
export type Ekran = 'kasa' | 'mutfak' | 'tv' | 'yonetim'
export type CihazEkrani = Exclude<Ekran, 'yonetim'>
export const EKRANLAR: Ekran[] = ['kasa', 'mutfak', 'tv', 'yonetim']
export const EKRAN_ADI: Record<Ekran, string> = { kasa: 'Kasa', mutfak: 'Mutfak', tv: 'TV ekranı', yonetim: 'Yönetim' }
export const PIN_ISTEYEN: Ekran[] = ['kasa', 'mutfak']

export type Isletme = { id: string; slug: string; ad: string; logo: string }
export type IsletmeKaydi = Isletme & { rol: string; tetra: boolean; abonelik: boolean; gorunum: Gorunum | null }
export type Yonetici =
  | { durum: 'yukleniyor' }
  | { durum: 'yok' }
  | { durum: 'var'; eposta: string; isletmeler: IsletmeKaydi[]; secili: IsletmeKaydi | null; hata: string }
export type Cihaz =
  | { durum: 'yok' }
  | { durum: 'yukleniyor'; ekran: CihazEkrani; ad: string; isletme: Isletme }
  | { durum: 'hazir'; id: string; ekran: CihazEkrani; ad: string; isletme: Isletme; kanal: string; personel: { id: string; ad: string } | null; personelTanimli: boolean }
  | { durum: 'hata'; ekran: CihazEkrani; ad: string; isletme: Isletme; hata: string; kapali: boolean }

type CihazKaydi = { anahtar: string; ekran: CihazEkrani; ad: string; isletme: Isletme }
type CihazYaniti = {
  cihaz: { id: string; ekran: CihazEkrani; ad: string }
  isletme: Isletme
  kanal: string
  gorunum: unknown
  personel: { id: string; ad: string } | null
  personel_tanimli: boolean
}

const A_CIHAZ = 'tetra-cihaz'
const A_OTURUM = 'tetra-personel-oturum'
const A_ISLETME = 'tetra-isletme'
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

let yonetici: Yonetici = { durum: 'yukleniyor' }
let kayit: CihazKaydi | null = (() => {
  const k = oku<Partial<CihazKaydi>>('local', A_CIHAZ)
  return k && typeof k.anahtar === 'string' && /^[0-9a-f]{64}$/.test(k.anahtar) && k.isletme && (k.ekran === 'kasa' || k.ekran === 'mutfak' || k.ekran === 'tv')
    ? (k as CihazKaydi)
    : null
})()
let cihaz: Cihaz = kayit ? { durum: 'yukleniyor', ekran: kayit.ekran, ad: kayit.ad, isletme: kayit.isletme } : { durum: 'yok' }
let personelOturum: string | null = oku<string>('session', A_OTURUM)
let cihazNotu = '' // cihaz kaldırıldığında giriş ekranında gösterilecek açıklama

const ayarlaYonetici = (y: Yonetici) => {
  yonetici = y
  if (y.durum === 'var' && y.secili) gorunumUygula(y.secili.gorunum)
  duyur()
}
const ayarlaCihaz = (c: Cihaz) => {
  cihaz = c
  duyur()
}

/* ───────── yönetici ───────── */
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function yoneticiYukle(eposta: string) {
  try {
    const liste = (await cagir<IsletmeKaydi[]>('tetra_baslangic')).map((i) => ({ ...i, gorunum: gecerli(i.gorunum) }))
    const tetraAcik = liste.filter((i) => i.tetra)
    const kayitli = oku<string>('local', A_ISLETME)
    const secili = tetraAcik.find((i) => i.id === kayitli) ?? (tetraAcik.length === 1 ? tetraAcik[0] : null)
    ayarlaYonetici({ durum: 'var', eposta, isletmeler: liste, secili, hata: '' })
  } catch (e) {
    ayarlaYonetici({ durum: 'var', eposta, isletmeler: [], secili: null, hata: hataMetni(e) })
  }
}

sunucu.auth
  .getSession()
  .then(({ data }) => {
    const eposta = data.session?.user.email
    if (eposta) return yoneticiYukle(eposta)
    ayarlaYonetici({ durum: 'yok' })
  })
  .catch(() => ayarlaYonetici({ durum: 'yok' }))

export async function girisYap(eposta: string, sifre: string): Promise<Sonuc> {
  const e = eposta.trim().toLowerCase()
  if (!EPOSTA.test(e) || e.length > 254) return { tamam: false, hata: 'Geçerli bir e-posta adresi yazın.' }
  if (sifre.length < 8 || sifre.length > 128) return { tamam: false, hata: 'Şifre en az 8 karakter olmalı.' }
  // Giriş, sunucudaki "tetra-giris" kapısından geçer: 15 dakikada 5 hatalı deneme hesabı 15 dakika kilitler.
  type Kapi = { tamam: boolean; neden?: string; kalan?: number; kilit?: number; oturum?: { access_token: string; refresh_token: string } }
  const ULASILAMADI = 'Sunucuya ulaşılamadı. İnternet bağlantısını denetleyin.'
  let kapi: Kapi | null = null
  try {
    const r = await sunucu.functions.invoke<Kapi>('tetra-giris', { body: { eposta: e, sifre, dogrulama: await dogrulamaAl() } })
    kapi = r.data ?? null
  } catch {
    kapi = null
  }
  if (!kapi) return { tamam: false, hata: ULASILAMADI }
  if (!kapi.tamam || !kapi.oturum) {
    if (kapi.neden === 'kilit') {
      const dk = Math.max(1, Math.ceil((kapi.kilit ?? 900) / 60))
      return { tamam: false, hata: `Çok fazla hatalı deneme yapıldı. Hesap güvenlik için kilitlendi; ${dk} dakika sonra yeniden deneyin.` }
    }
    if (kapi.neden === 'dogrulama') return { tamam: false, hata: 'Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip yeniden deneyin.' }
    if (kapi.neden === 'yogun') return { tamam: false, hata: 'Çok fazla deneme yapıldı. Biraz bekleyip yeniden deneyin.' }
    if (kapi.neden === 'hatali') {
      const k = kapi.kalan
      return { tamam: false, hata: typeof k === 'number' && k <= 3 ? `E-posta ya da şifre hatalı. ${k} deneme hakkınız kaldı.` : 'E-posta ya da şifre hatalı.' }
    }
    if (kapi.neden === 'gecersiz') return { tamam: false, hata: 'E-posta ya da şifre hatalı.' }
    return { tamam: false, hata: ULASILAMADI }
  }
  let yanit
  try {
    yanit = await sunucu.auth.setSession(kapi.oturum)
  } catch {
    return { tamam: false, hata: ULASILAMADI }
  }
  if (yanit.error || !yanit.data.session) return { tamam: false, hata: ULASILAMADI }
  if (yanit.data.user?.user_metadata?.must_change_password === true) {
    await sunucu.auth.signOut({ scope: 'local' })
    return { tamam: false, hata: 'İlk girişte geçici şifreni değiştirmen gerekiyor. Önce NearMenu panelinden şifreni belirle.' }
  }
  await yoneticiYukle(e)
  return { tamam: true }
}

export async function cikis() {
  try {
    await sunucu.auth.signOut({ scope: 'local' })
  } catch {
    /* yerel oturum yine de silinir */
  }
  ayarlaYonetici({ durum: 'yok' })
}

/** İşletme sahibi görünümü kaydettikten sonra yerel kaydı günceller ve bu ekrana uygular. */
export function gorunumGuncelle(id: string, g: Gorunum) {
  const y = yonetici
  if (y.durum !== 'var') return
  const isletmeler = y.isletmeler.map((i) => (i.id === id ? { ...i, gorunum: g } : i))
  ayarlaYonetici({ ...y, isletmeler, secili: isletmeler.find((i) => i.id === y.secili?.id) ?? y.secili })
}

export function isletmeSec(id: string) {
  if (yonetici.durum !== 'var') return
  const secili = yonetici.isletmeler.find((i) => i.id === id && i.tetra) ?? null
  yaz('local', A_ISLETME, secili?.id ?? null)
  ayarlaYonetici({ ...yonetici, secili })
}

/* ───────── cihaz ───────── */
function cihazUnut(not = '') {
  kayit = null
  personelOturum = null
  cihazNotu = not
  yaz('local', A_CIHAZ, null)
  yaz('session', A_OTURUM, null)
  ayarlaCihaz({ durum: 'yok' })
}

function personelDustu() {
  personelOturum = null
  yaz('session', A_OTURUM, null)
  if (cihaz.durum === 'hazir') ayarlaCihaz({ ...cihaz, personel: null })
}

/** Cihaz işlevini cihaz anahtarı ve personel oturumuyla çağırır; oturum ya da cihaz düştüyse durumu günceller. */
export async function cihazCagir<T>(ad: string, govde: Record<string, unknown> = {}, oturumlu = true): Promise<T> {
  if (!kayit) throw new SunucuHatasi('Bu cihaz tanıtılmamış.', 'TT002')
  try {
    return await cagir<T>(ad, { p_anahtar: kayit.anahtar, ...(oturumlu ? { p_oturum: personelOturum } : {}), ...govde })
  } catch (e) {
    if (e instanceof SunucuHatasi) {
      if (e.kod === 'TT001') personelDustu()
      else if (e.kod === 'TT002') cihazUnut('Bu cihaz Yönetim bölümünden kaldırılmış. Yeniden tanıtmak için giriş yapın.')
      else if (e.kod === 'TT003' && kayit) ayarlaCihaz({ durum: 'hata', ekran: kayit.ekran, ad: kayit.ad, isletme: kayit.isletme, hata: e.message, kapali: true })
    }
    throw e
  }
}

let yenileniyor: Promise<void> | null = null
/** Cihazın sunucudaki durumunu okur: işletme, açık personel oturumu, personel tanımlı mı. */
export function cihazYenile(): Promise<void> {
  if (!kayit) return Promise.resolve()
  yenileniyor ??= (async () => {
    const k = kayit
    if (!k) return
    try {
      const y = await cihazCagir<CihazYaniti>('tetra_cihaz_durum')
      if (!y.personel && personelOturum) {
        personelOturum = null
        yaz('session', A_OTURUM, null)
      }
      kayit = { ...k, ekran: y.cihaz.ekran, ad: y.cihaz.ad, isletme: y.isletme }
      yaz('local', A_CIHAZ, kayit)
      gorunumUygula(y.gorunum)
      ayarlaCihaz({ durum: 'hazir', id: y.cihaz.id, ekran: y.cihaz.ekran, ad: y.cihaz.ad, isletme: y.isletme, kanal: y.kanal, personel: y.personel, personelTanimli: y.personel_tanimli })
    } catch (e) {
      if (kayit && !(e instanceof SunucuHatasi && (e.kod === 'TT002' || e.kod === 'TT003')))
        ayarlaCihaz({ durum: 'hata', ekran: k.ekran, ad: k.ad, isletme: k.isletme, hata: hataMetni(e), kapali: false })
    } finally {
      yenileniyor = null
    }
  })()
  return yenileniyor
}
if (kayit) void cihazYenile()
// işletme sahibi görünümü değiştirdiğinde (canlı kanal haberi) cihaz yeni renkleri okur
if (typeof window !== 'undefined') window.addEventListener('tetra-gorunum', () => { if (kayit) void cihazYenile() })

/** Bu tableti kasa / mutfak / TV olarak tanıtır. Yönetici oturumu bu cihazda kapatılır: cihaz yalnızca kendi anahtarını taşır. */
export async function cihazTanit(isletme: Isletme, ekran: CihazEkrani, ad: string): Promise<Sonuc> {
  try {
    const y = await cagir<{ tamam: boolean; hata?: string; anahtar?: string }>('tetra_cihaz_ekle', { p_restaurant: isletme.id, p_ekran: ekran, p_ad: ad })
    if (!y.tamam || !y.anahtar) return { tamam: false, hata: y.hata ?? 'Cihaz tanıtılamadı.' }
    kayit = { anahtar: y.anahtar, ekran, ad: ad.trim(), isletme: { id: isletme.id, slug: isletme.slug, ad: isletme.ad, logo: isletme.logo } }
    if (!yaz('local', A_CIHAZ, kayit)) {
      kayit = null
      return { tamam: false, hata: 'Bu tarayıcı kayıt tutmaya izin vermiyor (gizli sekme olabilir). Cihaz tanıtılamadı.' }
    }
    personelOturum = null
    yaz('session', A_OTURUM, null)
    cihazNotu = ''
    ayarlaCihaz({ durum: 'yukleniyor', ekran, ad: kayit.ad, isletme: kayit.isletme })
    await cikis()
    await cihazYenile()
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Yönetici, üzerinde çalıştığı bu cihazın tanıtımını kaldırır. */
export async function buCihaziKaldir(isletmeId: string): Promise<Sonuc> {
  if (cihaz.durum !== 'hazir') {
    cihazUnut()
    return { tamam: true }
  }
  try {
    await cagir('tetra_cihaz_sil', { p_restaurant: isletmeId, p_id: cihaz.id })
    cihazUnut()
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

export async function pinDogrula(pin: string): Promise<Sonuc> {
  if (!/^\d{4}$/.test(pin)) return { tamam: false, hata: 'PIN 4 haneli olmalı.' }
  try {
    const y = await cihazCagir<{ tamam: boolean; hata?: string; oturum?: string; personel?: { id: string; ad: string } }>('tetra_pin', { p_pin: pin }, false)
    if (!y.tamam || !y.oturum || !y.personel) return { tamam: false, hata: y.hata ?? 'PIN doğrulanamadı.' }
    personelOturum = y.oturum
    yaz('session', A_OTURUM, y.oturum)
    if (cihaz.durum === 'hazir') ayarlaCihaz({ ...cihaz, personel: y.personel })
    else await cihazYenile()
    return { tamam: true }
  } catch (e) {
    return { tamam: false, hata: hataMetni(e) }
  }
}

/** Ekranı kilitler: personel oturumu sunucuda da kapanır. */
export async function kilitle() {
  personelDustu()
  try {
    await cihazCagir('tetra_kilitle', {}, false)
  } catch {
    /* bağlantı yoksa yerel oturum yine de kapanmıştır; sunucudaki oturum süresi dolunca düşer */
  }
}

/** Sipariş hazır olduğunda müşterinin telefonuna bildirim gönderilmesini ister (sunucu işlevi gönderir). */
export function bildirimGonder(siparisId: string) {
  if (!kayit) return
  void sunucu.functions.invoke('tetra-bildir', { body: { anahtar: kayit.anahtar, siparis: siparisId } }).catch(() => {
    /* bildirim gönderilemese de sipariş hazır olarak işaretlidir; açık takip sayfaları yine güncellenir */
  })
}

export const cihazNotuAl = () => {
  const n = cihazNotu
  cihazNotu = ''
  return n
}

function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
export const useYonetici = () => useSyncExternalStore(abone, () => yonetici)
export const useCihaz = () => useSyncExternalStore(abone, () => cihaz)
