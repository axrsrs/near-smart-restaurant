import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoNear from '../assets/near-logo.png'
import GirisKabugu from '../components/GirisKabugu'
import Ikon from '../components/Ikon'
import { cihazYenile, EKRAN_ADI, pinDogrula, type CihazEkrani, type Isletme } from '../lib/oturum'

const TUSLAR = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const TUS =
  'h-[60px] rounded-xl border border-text/10 bg-text/5 text-[22px] font-semibold tabular-nums transition active:bg-gold/20 disabled:opacity-50'

/** Kasa ve mutfak cihazında personel girişi. PIN ve deneme sınırı sunucuda denetlenir. */
export default function PinGiris({ ekran, isletme, personelTanimli }: { ekran: CihazEkrani; isletme: Isletme; personelTanimli: boolean }) {
  const git = useNavigate()
  const [pin, setPin] = useState('')
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)
  const pinRef = useRef('')
  const mesgul = useRef(false)

  const bas = useCallback(
    (tus: string) => {
      if (mesgul.current || !personelTanimli) return
      const p = pinRef.current
      const yeni = tus === 'sil' ? p.slice(0, -1) : p.length < 4 ? p + tus : p
      pinRef.current = yeni
      setPin(yeni)
      setHata('')
      if (yeni.length < 4) return
      mesgul.current = true
      setBekle(true)
      pinDogrula(yeni).then((s) => {
        mesgul.current = false
        setBekle(false)
        if (!s.tamam) {
          pinRef.current = ''
          setPin('')
          setHata(s.hata)
        }
      })
    },
    [personelTanimli],
  )

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) bas(e.key)
      else if (e.key === 'Backspace') bas('sil')
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [bas])

  return (
    <GirisKabugu genislik="max-w-[340px]">
      {isletme.logo ? (
        <img src={isletme.logo} alt={isletme.ad} className="mx-auto mb-3.5 h-10 w-auto max-w-40 object-contain" />
      ) : (
        <img src={logoNear} alt="NEAR Agency" width={560} height={146} className="near-logo mx-auto mb-3.5 h-[34px] w-auto" />
      )}
      <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">{EKRAN_ADI[ekran]}</p>
      <h1 className="mb-1.5 text-center text-[22px] leading-tight font-semibold tracking-tight">Personel girişi</h1>
      {!personelTanimli ? (
        <>
          <p className="mb-5 text-center text-[13px] text-muted">
            {EKRAN_ADI[ekran]} ekranı için tanımlı personel yok. Yönetici, Yönetim bölümünden personel ekleyip PIN verdikten sonra bu ekran açılır.
          </p>
          <button type="button" onClick={() => void cihazYenile()} className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-text text-[15px] font-semibold text-ink">
            <Ikon ad="yenile" className="size-4" />
            Yeniden denetle
          </button>
        </>
      ) : (
        <>
          <p className="mb-5 text-center text-[13px] text-muted">{isletme.ad} · 4 haneli PIN kodunu gir</p>
          <div key={hata} role="img" aria-label={`${pin.length} / 4 hane girildi`} className={`mb-2 flex justify-center gap-3.5 ${hata ? 'salla' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`size-3.5 rounded-full border-[1.5px] transition-colors ${i < pin.length ? 'border-gold bg-gold' : 'border-text/35'}`} />
            ))}
          </div>
          <p role="alert" aria-live="polite" className="mb-3 min-h-5 text-center text-[13px] text-danger">
            {hata}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {TUSLAR.map((t) => (
              <button key={t} type="button" disabled={bekle} onClick={() => bas(t)} className={TUS}>
                {t}
              </button>
            ))}
            <span aria-hidden="true" />
            <button type="button" disabled={bekle} onClick={() => bas('0')} className={TUS}>
              0
            </button>
            <button type="button" disabled={bekle} onClick={() => bas('sil')} aria-label="Son haneyi sil" title="Sil" className={`${TUS} grid place-items-center`}>
              <Ikon ad="sil" className="size-6" />
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={() => git('/giris')} className="mt-4 min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text">
        Yönetici girişi (e-posta ile)
      </button>
    </GirisKabugu>
  )
}
