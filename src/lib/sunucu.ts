/* NearMenu ile ortak sunucu (Supabase). Buradaki anahtar "publishable" türdedir: tarayıcıda bulunması normaldir;
   tek başına yalnızca herkese açık okumalara izin verir. Yetki gerektiren her şey sunucudaki işlevlerde denetlenir.
   Gizli anahtar bu projede yer almaz. */
import { createClient } from '@supabase/supabase-js'

const ADRES = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://rfwgjzkewtjpdcvrhepg.supabase.co'
const ANAHTAR = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2'

export const sunucu = createClient(ADRES, ANAHTAR, {
  auth: { storageKey: 'tetra-yonetici', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/** Sunucunun bilerek döndürdüğü hata. kod: TT001 personel oturumu kapalı · TT002 cihaz tanınmadı · TT003 paket/abonelik kapalı */
export class SunucuHatasi extends Error {
  kod: string
  constructor(mesaj: string, kod: string) {
    super(mesaj)
    this.kod = kod
  }
}

const BAGLANTI = 'Sunucuya ulaşılamadı. İnternet bağlantısını denetleyip yeniden deneyin.'

/** Sunucu işlevini çağırır. Ağ hatasında ve sunucunun reddinde SunucuHatasi fırlatır. */
export async function cagir<T>(ad: string, govde: Record<string, unknown> = {}): Promise<T> {
  let yanit
  try {
    yanit = await sunucu.rpc(ad, govde)
  } catch {
    throw new SunucuHatasi(BAGLANTI, 'AG')
  }
  if (yanit.error) {
    const kod = yanit.error.code ?? ''
    /* TT kodlu ve yetki (42501) hataları sunucunun yazdığı Türkçe iletiyi taşır; diğerleri iç ayrıntı sızdırmasın diye gizlenir */
    if (/^TT\d{3}$/.test(kod) || kod === '42501') throw new SunucuHatasi(yanit.error.message, kod)
    throw new SunucuHatasi(kod ? 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' : BAGLANTI, kod || 'AG')
  }
  return yanit.data as T
}

export const hataMetni = (e: unknown) => (e instanceof SunucuHatasi ? e.message : 'Beklenmeyen bir hata oluştu.')
