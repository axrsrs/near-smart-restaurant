import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET } from '../components/bicim'
import Ikon from '../components/Ikon'
import Pencere from '../components/Pencere'
import UstBar from '../components/UstBar'
import { buCihaziKaldir, cihazTanit, cikis, EKRAN_ADI, EKRANLAR, isletmeSec, useCihaz, useYonetici, type CihazEkrani, type Ekran } from '../lib/oturum'

const ACIKLAMA: Record<Ekran, string> = {
  kasa: 'Bu cihazı kasa yap: sipariş al, fiş yazdır',
  mutfak: 'Bu cihazı mutfak ekranı yap: siparişleri hazırla',
  tv: 'Bu cihazı TV ekranı yap: hazır numaraları göster',
  yonetim: 'Personel, PIN kodları, cihazlar, raporlar',
}

export default function EkranSecimi() {
  const git = useNavigate()
  const y = useYonetici()
  const cihaz = useCihaz()
  const [tanit, setTanit] = useState<CihazEkrani | null>(null)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)
  if (y.durum !== 'var') return null

  const tetraAcik = y.isletmeler.filter((i) => i.tetra)
  const ic = (govde: React.ReactNode) => (
    <div className="min-h-dvh bg-ink">
      <UstBar />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">{govde}</main>
    </div>
  )

  if (y.hata)
    return ic(
      <div className="max-w-xl rounded-2xl border border-line bg-ink-2 p-6">
        <h1 className="text-xl font-semibold tracking-tight">İşletme bilgileri alınamadı</h1>
        <p className="mt-1 text-sm text-muted">{y.hata}</p>
        <button type="button" onClick={() => location.reload()} className={`${BTN_ANA} mt-5`}>Yeniden dene</button>
      </div>,
    )

  if (!tetraAcik.length)
    return ic(
      <div className="max-w-xl rounded-2xl border border-line bg-ink-2 p-6">
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
          <Ikon ad="kilit" className="size-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Bu hesapta Tetra paketi açık değil</h1>
        <p className="mt-1 text-sm text-muted">
          {y.isletmeler.length
            ? 'İşletmen NearMenu paketinde. Kasa, mutfak ve TV ekranlarını kullanmak için paketine Tetra eklenmesi gerekiyor; NEAR ile iletişime geç.'
            : 'Bu hesaba bağlı bir işletme bulunamadı. Doğru hesapla giriş yaptığından emin ol.'}
        </p>
      </div>,
    )

  if (!y.secili)
    return ic(
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Hangi işletme?</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Bu hesap birden fazla işletmeye bağlı.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tetraAcik.map((i) => (
            <button key={i.id} type="button" onClick={() => isletmeSec(i.id)} className="flex min-h-20 items-center gap-4 rounded-2xl border border-line bg-ink-2 p-4 text-left transition hover:border-gold">
              <span className="grid h-12 w-16 flex-none place-items-center">{i.logo ? <img src={i.logo} alt="" className="max-h-full max-w-full object-contain" /> : <Ikon ad="dukkan" className="size-6 text-text/40" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">{i.ad}</span>
                <span className="block truncate text-[13px] text-muted">neardiji.com/{i.slug}</span>
              </span>
              <Ikon ad="ileri" className="size-4 flex-none text-text/40" />
            </button>
          ))}
        </div>
      </>,
    )

  const secili = y.secili
  return ic(
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Bu cihaz hangi ekran olacak?</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Kasa, mutfak ya da TV seçtiğinde cihaz o ekrana kilitlenir ve bu cihazdaki yönetici oturumun kapanır.</p>

      {cihaz.durum !== 'yok' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gold bg-ink-2 p-4 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm">
            Bu cihaz şu an <b className="font-semibold">{cihaz.ad}</b> ({EKRAN_ADI[cihaz.ekran]}) olarak tanıtılmış.
          </p>
          <button
            type="button"
            onClick={async () => {
              await cikis()
              git(`/${cihaz.ekran}`, { replace: true })
            }}
            className={BTN_ANA}
          >
            {EKRAN_ADI[cihaz.ekran]} ekranına dön
          </button>
          <button
            type="button"
            disabled={bekle}
            onClick={async () => {
              setBekle(true)
              const s = await buCihaziKaldir(secili.id)
              setBekle(false)
              setHata(s.tamam ? '' : s.hata)
            }}
            className={`${BTN_IKINCIL} text-danger`}
          >
            Tanıtımı kaldır
          </button>
        </div>
      )}
      <p role="alert" className="mb-2 min-h-5 text-[13px] text-danger">{hata}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EKRANLAR.map((e) => (
          <button
            key={e}
            type="button"
            disabled={e !== 'yonetim' && cihaz.durum !== 'yok'}
            onClick={() => (e === 'yonetim' ? git('/yonetim') : setTanit(e))}
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-ink-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="grid size-12 flex-none place-items-center rounded-xl bg-soft text-gold">
              <Ikon ad={e} className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{EKRAN_ADI[e]}</span>
              <span className="block text-[13px] text-muted">{ACIKLAMA[e]}</span>
            </span>
            <Ikon ad="ileri" className="size-4 flex-none text-text/40 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>

      {tanit && <TanitPenceresi ekran={tanit} kapat={() => setTanit(null)} tanit={(ad) => cihazTanit(secili, tanit, ad)} bitti={() => git(`/${tanit}`, { replace: true })} />}
    </>,
  )
}

function TanitPenceresi({ ekran, kapat, tanit, bitti }: { ekran: CihazEkrani; kapat: () => void; tanit: (ad: string) => Promise<{ tamam: boolean; hata?: string }>; bitti: () => void }) {
  const [ad, setAd] = useState(ekran === 'tv' ? 'TV' : `${EKRAN_ADI[ekran]} 1`)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)

  const gonder = async (e: FormEvent) => {
    e.preventDefault()
    if (bekle) return
    setBekle(true)
    const s = await tanit(ad)
    if (s.tamam) return bitti()
    setBekle(false)
    setHata(s.hata ?? 'Cihaz tanıtılamadı.')
  }

  return (
    <Pencere baslik={`Bu cihazı ${EKRAN_ADI[ekran]} yap`} kapat={kapat}>
      <form onSubmit={gonder} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Cihaz {EKRAN_ADI[ekran]} olarak tanıtılacak ve bu cihazdaki yönetici oturumun kapanacak. Yönetim'e bu cihazdan girmek için yeniden e-posta ve şifreyle giriş yapman gerekir.
        </p>
        <div>
          <label htmlFor="cihaz-ad" className={ETIKET}>Cihaz adı</label>
          <input id="cihaz-ad" value={ad} onChange={(e) => { setAd(e.target.value); setHata('') }} maxLength={40} autoComplete="off" className={ALAN} />
          <p className="mt-1.5 text-xs text-muted">Yönetim'deki cihaz listesinde bu adla görünür.</p>
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="submit" disabled={bekle} className={BTN_ANA}>{bekle ? 'Tanıtılıyor' : 'Cihazı tanıt'}</button>
        </div>
      </form>
    </Pencere>
  )
}
