/* Müşteriye "siparişiniz hazır" bildirimi (Web Push). Telefon numarası ya da kişisel veri toplanmaz:
   tarayıcının verdiği bildirim adresi yalnızca o siparişe bağlanır ve bildirim gönderilince silinir.
   iPhone, ana ekrana eklenmemiş sayfalara bildirim izni vermez; orada sayfa açıkken sesli uyarı çalışır. */
import { cagir } from './sunucu'

const ACIK_ANAHTAR = 'BFRCITN5dgpTDl4M9ZvIO1-GEpioIeRPJ3X4h1_K9Qh-Xic0y-Irsq4VU-wUDy9Y8vj35RVyYpC5lR1youLqPd4' // VAPID açık anahtarı (gizli eşi yalnızca sunucudadır)

export type BildirimDestegi = 'var' | 'yok' | 'reddedildi'

export function bildirimDestegi(): BildirimDestegi {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'yok'
  return Notification.permission === 'denied' ? 'reddedildi' : 'var'
}

const baytlar = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const metin = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')

/** Tarayıcının izin penceresini açar; izin verilirse bu siparişe bildirim aboneliği kaydeder. */
export async function bildirimAc(kod: string): Promise<{ tamam: true } | { tamam: false; hata: string }> {
  if (bildirimDestegi() === 'yok') return { tamam: false, hata: 'Bu tarayıcı bildirim desteklemiyor. Sayfa açık kaldıkça sesli uyarı verilir.' }
  let izin: NotificationPermission
  try {
    izin = await Notification.requestPermission()
  } catch {
    return { tamam: false, hata: 'Bildirim izni istenemedi.' }
  }
  if (izin !== 'granted') return { tamam: false, hata: 'Bildirim izni verilmedi. Sayfa açık kaldıkça sesli uyarı verilir.' }
  try {
    const kayit = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const abonelik = (await kayit.pushManager.getSubscription()) ?? (await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: baytlar(ACIK_ANAHTAR) }))
    const y = await cagir<{ tamam: boolean; hata?: string }>('tetra_takip_abone', {
      p_kod: kod,
      p_endpoint: abonelik.endpoint,
      p_p256dh: metin(abonelik.getKey('p256dh')),
      p_auth: metin(abonelik.getKey('auth')),
    })
    return y.tamam ? { tamam: true } : { tamam: false, hata: y.hata ?? 'Bildirim kaydedilemedi.' }
  } catch {
    return { tamam: false, hata: 'Bildirim kaydedilemedi. Sayfa açık kaldıkça sesli uyarı verilir.' }
  }
}
