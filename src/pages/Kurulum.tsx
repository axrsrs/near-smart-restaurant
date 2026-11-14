import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/near-logo.png'
import AkisArkaPlan from '../components/AkisArkaPlan'
import Ikon, { type IkonAdi } from '../components/Ikon'
import TemaDugmesi from '../components/TemaDugmesi'
import { sunucu } from '../lib/sunucu'

/** Bölüm ekrana girdiğinde yumuşakça belirir. Hareket azaltılmışsa ya da tarayıcı desteklemiyorsa doğrudan görünür. */
function Belir({ children, gecikme = 0, className = '' }: { children: ReactNode; gecikme?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('belir-bekle')
    const g = new IntersectionObserver(
      (kayitlar) => {
        if (kayitlar.some((k) => k.isIntersecting)) {
          el.classList.add('belir-gel')
          g.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    g.observe(el)
    return () => g.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ transitionDelay: `${gecikme}ms` }}>
      {children}
    </div>
  )
}

/* her adımın yanında, o adımı anlatan küçük canlı çizim */
const CizimGiris = () => (
  <div className="kur-cizim" aria-hidden="true">
    <div className="mx-auto w-40 rounded-xl border border-line bg-ink p-3">
      <div className="mb-2 h-2 w-16 rounded-full bg-text/20" />
      <div className="mb-1.5 h-6 rounded-md bg-text/8" />
      <div className="mb-2 flex h-6 items-center gap-1 rounded-md bg-text/8 px-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="kur-nokta size-1.5 rounded-full bg-text" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <div className="kur-nabiz h-6 rounded-md bg-text" />
    </div>
  </div>
)
const CizimPersonel = () => (
  <div className="kur-cizim" aria-hidden="true">
    <div className="mx-auto flex w-44 flex-col gap-2">
      {['Ayşe', 'Mehmet'].map((ad, i) => (
        <div key={ad} className="kur-kay flex items-center gap-2 rounded-xl border border-line bg-ink p-2.5" style={{ animationDelay: `${i * 0.5}s` }}>
          <span className="grid size-7 place-items-center rounded-full bg-soft text-xs font-bold text-gold">{ad[0]}</span>
          <span className="flex-1 text-sm font-semibold">{ad}</span>
          <span className="flex gap-0.5">{[0, 1, 2, 3].map((n) => <span key={n} className="size-1.5 rounded-full bg-gold" />)}</span>
        </div>
      ))}
    </div>
  </div>
)
const CizimCihaz = () => (
  <div className="kur-cizim" aria-hidden="true">
    <div className="mx-auto flex w-48 items-end justify-center gap-2.5">
      {(['kasa', 'mutfak', 'tv'] as IkonAdi[]).map((ik, i) => (
        <div key={ik} className="kur-yuksel grid flex-1 place-items-center rounded-xl border border-line bg-ink py-3 text-gold" style={{ animationDelay: `${i * 0.35}s` }}>
          <Ikon ad={ik} className="size-6" />
        </div>
      ))}
    </div>
  </div>
)
const CizimSiparis = () => (
  <div className="kur-cizim" aria-hidden="true">
    <div className="mx-auto grid w-48 grid-cols-2 overflow-hidden rounded-xl border border-line bg-ink text-center">
      <div className="p-2.5">
        <p className="text-[9px] font-semibold tracking-wider text-muted uppercase">Hazırlanıyor</p>
        <p className="kur-sol text-2xl font-bold tabular-nums">12</p>
      </div>
      <div className="bg-ok/15 p-2.5">
        <p className="text-[9px] font-semibold tracking-wider text-ok uppercase">Hazır</p>
        <p className="kur-sag text-2xl font-bold text-ok tabular-nums">12</p>
      </div>
    </div>
  </div>
)
const CizimBildirim = () => (
  <div className="kur-cizim" aria-hidden="true">
    <div className="mx-auto w-28 rounded-2xl border border-line bg-ink p-2 pt-4">
      <div className="kur-dus rounded-lg bg-ok px-2 py-1.5 text-[10px] leading-tight font-semibold text-on-ok">
        Siparişiniz hazır: 12
      </div>
      <div className="mt-2 grid place-items-center pb-3 text-gold">
        <span className="kur-zil"><Ikon ad="zil" className="size-7" /></span>
      </div>
    </div>
  </div>
)

const ADIMLAR: { baslik: string; metin: string; ipucu: string; cizim: ReactNode }[] = [
  {
    baslik: 'Giriş yapın',
    metin: 'tetra.neardiji.com adresini açın ve NearMenu panelinde kullandığınız e-posta ile şifreyi yazın. Yeni bir hesap açmanıza gerek yok; menünüz, ürünleriniz ve fiyatlarınız sizi bekliyor.',
    ipucu: 'İlk kez giriyorsanız önce NearMenu panelinde geçici şifrenizi değiştirin.',
    cizim: <CizimGiris />,
  },
  {
    baslik: 'Ekibinizi ekleyin',
    metin: 'Yönetim › Personel bölümünde kasada ve mutfakta çalışan herkesi ekleyin. Her kişiye yalnızca kendisinin bildiği 4 haneli bir PIN verin; hangi siparişi kimin aldığı böylece hep belli olur.',
    ipucu: 'Bir personel ayrılırsa silmek yerine girişini kapatabilirsiniz.',
    cizim: <CizimPersonel />,
  },
  {
    baslik: 'Cihazlarınızı yerleştirin',
    metin: 'Kasa olacak tablette giriş yapın ve “Kasa”yı seçin. Aynısını mutfak tableti ve müşterilerin göreceği TV için tekrarlayın. Her cihaz bir kez tanıtılır; sonraki açılışlarda doğrudan kendi ekranı gelir.',
    ipucu: 'TV’de tam ekran düğmesine ve sesli uyarı için ekrana bir kez dokunun.',
    cizim: <CizimCihaz />,
  },
  {
    baslik: 'İlk siparişinizi alın',
    metin: 'Kasada ürünlere dokunun, notunu ekleyin, “Burada” ya da “Paket”i seçip ödemeyi işaretleyin. Sipariş aynı anda mutfağa düşer; mutfak “Hazır” dediğinde numara TV’de belirir.',
    ipucu: 'Biten ürünü kasadan “tükendi” yapın; QR menünüzde de anında görünür.',
    cizim: <CizimSiparis />,
  },
  {
    baslik: 'Müşteriniz beklerken rahat etsin',
    metin: 'Fişteki QR kodu okutan müşteri siparişini kendi telefonundan izler. “Hazır olunca haber ver”e basarsa, sırası geldiğinde telefonuna bildirim gider. Kimse tezgâhın önünde beklemek zorunda kalmaz.',
    ipucu: 'Fiş yazıcınız yoksa QR kodu sipariş sonrası kasa ekranında da görünür.',
    cizim: <CizimBildirim />,
  },
]

/** Yeni işletmeye gönderilen ilk kurulum sayfası. Giriş gerektirmez. */
export default function Kurulum() {
  /* destek WhatsApp numarası NearDiji site ayarlarındaki iletişim bilgisinden okunur; boşsa düğme görünmez */
  const [whatsapp, setWhatsapp] = useState('')
  useEffect(() => {
    let iptal = false
    sunucu
      .from('site_content')
      .select('data')
      .eq('key', 'main')
      .maybeSingle()
      .then(({ data }) => {
        const ham = (data?.data as { contact?: { whatsapp?: unknown } } | null)?.contact?.whatsapp
        /* panelde "0555 555 55 55" biçiminde de yazılabilir: baştaki 0 atılır, 10 haneli numaraya Türkiye kodu eklenir */
        let rakam = typeof ham === 'string' ? ham.replace(/\D/g, '').replace(/^0+/, '') : ''
        if (rakam.length === 10) rakam = '90' + rakam
        if (!iptal && rakam.length >= 11 && rakam.length <= 15) setWhatsapp(rakam)
      })
    return () => {
      iptal = true
    }
  }, [])
  const waAdres = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Merhaba, Tetra kurulumu için yazıyorum.')}`

  return (
    <div data-near className="min-h-dvh bg-ink">
      <header className="relative isolate overflow-hidden">
        <AkisArkaPlan />
        <div className="relative z-[1] mx-auto flex max-w-3xl flex-col items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-16 text-center sm:pb-24">
          <div className="flex w-full justify-end">
            <TemaDugmesi />
          </div>
          <img src={logo} alt="NEAR Agency" width={560} height={146} className="near-logo kur-giris mt-8 h-9 w-auto sm:mt-14" />
          <p className="kur-giris mt-5 text-[11px] font-semibold tracking-[0.3em] text-gold uppercase" style={{ animationDelay: '0.12s' }}>Tetra</p>
          <h1 className="kur-giris mt-4 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl" style={{ animationDelay: '0.24s' }}>
            Siparişleriniz artık kendi akışında.
          </h1>
          <p className="kur-giris mt-5 max-w-xl text-base text-muted text-pretty sm:text-lg" style={{ animationDelay: '0.36s' }}>
            Tetra’ya hoş geldiniz. Kasanız, mutfağınız ve müşterinizin telefonu aynı anda aynı şeyi görür. Kurulum beş adım ve yaklaşık on dakika sürer.
          </p>
          <Link to="/giris" className="kur-giris group mt-8 inline-flex h-14 items-center gap-2 rounded-[12px] bg-text px-7 text-base font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.98]" style={{ animationDelay: '0.48s' }}>
            Tetra’yı aç
            <Ikon ad="ok" className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-3xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))]">
        <ol className="kur-liste flex flex-col gap-5">
          {ADIMLAR.map((a, i) => (
            <li key={a.baslik}>
              <Belir className="kur-kart grid gap-5 rounded-3xl border border-line bg-ink-2 p-5 sm:grid-cols-[1fr_13rem] sm:items-center sm:p-7">
                <div>
                  <p className="flex items-center gap-3">
                    <span className="grid size-10 flex-none place-items-center rounded-full bg-text text-base font-bold text-ink tabular-nums">{i + 1}</span>
                    <span className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Adım {i + 1} / {ADIMLAR.length}</span>
                  </p>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance">{a.baslik}</h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted text-pretty">{a.metin}</p>
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-soft px-3.5 py-2.5 text-[13px] leading-snug text-gold">
                    <Ikon ad="tik" className="mt-0.5 size-4 flex-none" />
                    <span>{a.ipucu}</span>
                  </p>
                </div>
                {a.cizim}
              </Belir>
            </li>
          ))}
        </ol>

        <Belir className="mt-10 rounded-3xl bg-text p-7 text-center text-ink sm:p-10">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">Hepsi bu kadar.</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed opacity-75 text-pretty">
            İlk siparişinizi aldığınızda geri kalanı kendiliğinden yerine oturur. Takıldığınız bir yer olursa bize yazmanız yeterli; birlikte çözeriz.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/giris" className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-ink px-7 text-base font-semibold text-text transition hover:scale-[1.03] active:scale-[0.98] sm:w-auto">
              Kuruluma başla
              <Ikon ad="ok" className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {whatsapp && (
              <a href={waAdres} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[12px] border border-ink/30 px-7 text-base font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.98] sm:w-auto">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.3 4.1c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3l-.6-.4-1.9-.9c-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1a7 7 0 0 1-2-1.3 7.6 7.6 0 0 1-1.4-1.8c-.2-.3 0-.4.1-.6l.4-.5.3-.5v-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.4Z" /></svg>
                WhatsApp'tan yazın
              </a>
            )}
          </div>
        </Belir>
        <p className="mt-8 text-center text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Tetra · NEAR</p>
      </main>
    </div>
  )
}
