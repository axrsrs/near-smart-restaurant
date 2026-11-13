/* "Uygulama olarak yükle": hangi ekrandaysa o ekranın uygulaması yüklenir.
   /kasa → Tetra Kasa, /mutfak → Tetra Mutfak, /tv → Tetra TV, diğerleri → Tetra.
   Müşterinin takip sayfası (/t/…) ve kurulum sayfası işletme uygulaması olarak önerilmez. */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const UYGULAMA: Record<string, { manifest: string; ikon: string; ad: string }> = {
  kasa: { manifest: '/manifest-kasa.webmanifest', ikon: '/ikon/kasa-apple-180.png', ad: 'Kasa' },
  mutfak: { manifest: '/manifest-mutfak.webmanifest', ikon: '/ikon/mutfak-apple-180.png', ad: 'Mutfak' },
  tv: { manifest: '/manifest-tv.webmanifest', ikon: '/ikon/tv-apple-180.png', ad: 'Tetra TV' },
}
const GENEL = { manifest: '/manifest.webmanifest', ikon: '/ikon/tetra-apple-180.png', ad: 'Tetra' }

function etiket(secici: string, olustur: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(secici) ?? document.head.appendChild(olustur())
}

export function useUygulama() {
  const { pathname } = useLocation()
  useEffect(() => {
    const bolum = pathname.split('/')[1] ?? ''
    const musteri = bolum === 't' || bolum === 'kurulum'
    const u = UYGULAMA[bolum] ?? GENEL
    const bag = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (musteri) {
      bag?.remove()
    } else {
      const l = (bag ?? etiket('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest' }))) as HTMLLinkElement
      if (l.getAttribute('href') !== u.manifest) l.setAttribute('href', u.manifest)
    }
    const ikon = etiket('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement('link'), { rel: 'apple-touch-icon' })) as HTMLLinkElement
    if (ikon.getAttribute('href') !== u.ikon) ikon.setAttribute('href', u.ikon)
    const ad = etiket('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title' })) as HTMLMetaElement
    ad.content = musteri ? 'Sipariş' : u.ad
  }, [pathname])
}
