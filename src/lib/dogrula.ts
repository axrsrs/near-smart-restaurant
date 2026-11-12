/* Giriş güvenlik doğrulaması (Cloudflare Turnstile).
   Site anahtarı herkese açık anahtardır; gizli anahtar yalnızca Supabase panelinde durur.
   Anahtar boşken doğrulama kapalıdır: hiçbir şey yüklenmez, dogrulamaAl() null döner.
   Betik yalnızca giriş düğmesine basıldığında yüklenir. Kutu çoğu zaman görünmez;
   Cloudflare gerek görürse ekranın altında küçük bir onay kutusu açılır. */
const ANAHTAR = (import.meta.env.VITE_CAPTCHA_KEY as string | undefined) ?? ''

type Turnstile = {
  render: (hedef: HTMLElement, ayar: Record<string, unknown>) => string
  remove: (kimlik: string) => void
}
const pencere = window as unknown as { turnstile?: Turnstile }

let yukleme: Promise<void> | null = null
let kutu: HTMLDivElement | null = null
let kimlik: string | null = null

function yukle(): Promise<void> {
  if (yukleme) return yukleme
  yukleme = new Promise<void>((tamam, olmadi) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (pencere.turnstile ? tamam() : olmadi(new Error('yok')))
    s.onerror = () => {
      yukleme = null
      s.remove()
      olmadi(new Error('yüklenemedi'))
    }
    document.head.appendChild(s)
  })
  return yukleme
}

function kutuAl(): HTMLDivElement {
  if (kutu?.isConnected) return kutu
  kutu = document.createElement('div')
  kutu.style.cssText = 'position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 16px)'
  document.body.appendChild(kutu)
  return kutu
}

export const dogrulamaAcik = ANAHTAR !== ''

/** Tek kullanımlık doğrulama kodu. Doğrulama kapalıysa ya da alınamazsa null. */
export async function dogrulamaAl(): Promise<string | null> {
  if (!ANAHTAR) return null
  try {
    await yukle()
  } catch {
    return null
  }
  return new Promise((sonuc) => {
    let bitti = false
    const son = (kod: unknown) => {
      if (bitti) return
      bitti = true
      clearTimeout(sure)
      sonuc(typeof kod === 'string' && kod ? kod : null)
    }
    const sure = setTimeout(() => son(null), 90_000)
    const t = pencere.turnstile!
    if (kimlik !== null) {
      try {
        t.remove(kimlik)
      } catch {
        /* zaten kaldırılmış */
      }
      kimlik = null
    }
    try {
      kimlik = t.render(kutuAl(), {
        sitekey: ANAHTAR,
        appearance: 'interaction-only',
        language: 'tr',
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        callback: son,
        'error-callback': () => {
          son(null)
          return true
        },
        'timeout-callback': () => son(null),
      })
    } catch {
      son(null)
    }
  })
}
