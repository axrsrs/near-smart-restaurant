/* Tam ekran: yeni tarayıcılar requestFullscreen, iPad Safari webkitRequestFullscreen kullanır.
   iPhone web sayfalarına tam ekran izni vermez; orada uygulama olarak (Ana Ekrana Ekle) açmak gerekir. */
type Belge = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void }
type Oge = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

export const tamEkranda = () => {
  const d = document as Belge
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement) || matchMedia('(display-mode: fullscreen)').matches
}

export type TamEkranSonucu = 'acildi' | 'kapandi' | 'desteklenmiyor' | 'olmadi'

export async function tamEkranDegistir(): Promise<TamEkranSonucu> {
  const d = document as Belge
  const e = document.documentElement as Oge
  try {
    if (d.fullscreenElement ?? d.webkitFullscreenElement) {
      await (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())
      return 'kapandi'
    }
    if (typeof e.requestFullscreen === 'function') await e.requestFullscreen({ navigationUI: 'hide' })
    else if (typeof e.webkitRequestFullscreen === 'function') await e.webkitRequestFullscreen()
    else return 'desteklenmiyor'
    return 'acildi'
  } catch {
    return 'olmadi'
  }
}

/** Tam ekran açılamadığında gösterilecek açıklama (cihaza göre). */
export function tamEkranNotu(sonuc: TamEkranSonucu): string {
  if (sonuc === 'acildi' || sonuc === 'kapandi') return ''
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) return "Bu cihaz tarayıcıdan tam ekrana izin vermiyor. Safari'de Paylaş > Ana Ekrana Ekle ile açarsanız ekran adres çubuğu olmadan, tam ekran açılır."
  return 'Tam ekran açılamadı. Tarayıcının menüsünden "Tam ekran" seçeneğini kullanabilir ya da Tetra\'yı uygulama olarak yükleyebilirsiniz.'
}
