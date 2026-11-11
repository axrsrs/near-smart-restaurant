import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import logoNear from '../assets/near-logo.png'
import GirisKabugu from '../components/GirisKabugu'
import Ikon from '../components/Ikon'
import { BTN_ANA } from '../components/bicim'
import { cikis, EKRAN_ADI, PIN_ISTEYEN, pinDogrula, useOturum, usePersonel, type Ekran } from '../lib/oturum'
import { useIsletme } from '../lib/isletme'
import { usePersonelListesi, type Yetki } from '../lib/veri'

const TUSLAR = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const TUS =
  'h-[60px] rounded-xl border border-text/10 bg-text/5 text-[22px] font-semibold tabular-nums transition active:bg-gold/20 disabled:opacity-50'

export default function PinGiris() {
  const { ekran } = useParams()
  const oturum = useOturum()
  const personel = usePersonel()
  const git = useNavigate()
  const [pin, setPin] = useState('')
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)
  const gecerli = PIN_ISTEYEN.includes(ekran as Ekran)
  const hedef = ekran as Yetki
  const { ad, logo } = useIsletme()
  const tanimli = usePersonelListesi().some((k) => k.aktif && k.yetkiler.includes(hedef))

  const pinRef = useRef('')
  const mesgul = useRef(false)

  const bas = useCallback(
    (tus: string) => {
      if (mesgul.current || !gecerli || !tanimli) return
      const p = pinRef.current
      const yeni = tus === 'sil' ? p.slice(0, -1) : p.length < 4 ? p + tus : p
      pinRef.current = yeni
      setPin(yeni)
      setHata('')
      if (yeni.length < 4) return
      mesgul.current = true
      setBekle(true)
      pinDogrula(yeni, hedef).then((s) => {
        mesgul.current = false
        setBekle(false)
        if (s.tamam) git(`/${hedef}`, { replace: true })
        else {
          pinRef.current = ''
          setPin('')
          setHata(s.hata)
        }
      })
    },
    [gecerli, tanimli, hedef, git],
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

  if (!oturum) return <Navigate to="/giris" replace />
  if (!gecerli) return <Navigate to="/ekran" replace />
  if (personel?.ekran === hedef) return <Navigate to={`/${hedef}`} replace />

  return (
    <GirisKabugu genislik="max-w-[340px]">
      {logo ? (
        <img src={logo} alt={ad} className="mx-auto mb-3.5 h-10 w-auto max-w-40 object-contain" />
      ) : (
        <img src={logoNear} alt="NEAR Agency" width={560} height={146} className="near-logo mx-auto mb-3.5 h-[34px] w-auto" />
      )}
      <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">{EKRAN_ADI[hedef]}</p>
      <h1 className="mb-1.5 text-center text-[22px] leading-tight font-semibold tracking-tight">Personel girişi</h1>
      {!tanimli ? (
        <>
          <p className="mb-5 text-center text-[13px] text-muted">
            {EKRAN_ADI[hedef]} ekranı için tanımlı personel yok. Önce Yönetim bölümünden personel ekleyip PIN verin.
          </p>
          <button type="button" onClick={() => git('/yonetim/personel')} className={`${BTN_ANA} w-full`}>
            Personel ekle
          </button>
          <button type="button" onClick={() => git('/ekran')} className="mt-2 min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text">
            Ekran seçimine dön
          </button>
        </>
      ) : (
        <>
      <p className="mb-5 text-center text-[13px] text-muted">{ad} · 4 haneli PIN kodunu gir</p>

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
        <button
          type="button"
          onClick={() => git('/ekran')}
          aria-label="Ekran seçimine dön"
          title="Ekran seçimine dön"
          className={`${TUS} grid place-items-center`}
        >
          <Ikon ad="geri" className="size-5" />
        </button>
        <button type="button" disabled={bekle} onClick={() => bas('0')} className={TUS}>
          0
        </button>
        <button type="button" disabled={bekle} onClick={() => bas('sil')} aria-label="Son haneyi sil" title="Sil" className={`${TUS} grid place-items-center`}>
          <Ikon ad="sil" className="size-6" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          cikis()
          git('/giris', { replace: true })
        }}
        className="mt-4 min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text"
      >
        Yönetici girişi (e-posta ile)
      </button>
        </>
      )}
    </GirisKabugu>
  )
}
