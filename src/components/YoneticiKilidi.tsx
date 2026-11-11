import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/near-logo.png'
import { cikis, EKRAN_ADI, ekranYolu, useCihaz, yoneticiDogrula } from '../lib/oturum'
import GirisKabugu from './GirisKabugu'
import Ikon from './Ikon'

/** Cihaz kasa / mutfak / TV olarak kullanılırken Ekran seçimi ve Yönetim'e girmek için yönetici şifresi sorar. */
export default function YoneticiKilidi() {
  const cihaz = useCihaz()
  const git = useNavigate()
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)

  const gonder = async (e: FormEvent) => {
    e.preventDefault()
    if (bekle) return
    setBekle(true)
    const s = await yoneticiDogrula(sifre)
    setBekle(false)
    if (!s.tamam) {
      setHata(s.hata)
      setSifre('')
    }
  }

  return (
    <GirisKabugu>
      <form onSubmit={gonder} noValidate>
        <img src={logo} alt="NEAR Agency" width={560} height={146} className="near-logo mx-auto mb-3.5 h-[34px] w-auto" />
        <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Tetra</p>
        <h1 className="mb-1.5 text-center text-[22px] leading-tight font-semibold tracking-tight">Yönetici şifresi</h1>
        <p className="mb-6 text-center text-[13px] text-muted">Bu bölüm kilitli. Devam etmek için giriş şifresini yazın.</p>
        <div className="relative flex items-center text-text/45 focus-within:text-text">
          <Ikon ad="kilit" className="pointer-events-none absolute left-3.5 size-4" />
          <input
            id="yonetici-sifre"
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="Şifre"
            aria-label="Yönetici şifresi"
            maxLength={128}
            value={sifre}
            onChange={(e) => { setSifre(e.target.value); setHata('') }}
            className="h-12 w-full min-w-0 rounded-[10px] border border-transparent bg-text/6 pr-3.5 pl-11 text-base text-text outline-none transition placeholder:text-text/40 focus:border-gold focus:ring-3 focus:ring-gold/20"
          />
        </div>
        <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-[13px] text-danger">{hata}</p>
        <button type="submit" disabled={bekle} className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-text text-[15px] font-semibold text-ink transition hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-80">
          Kilidi aç
        </button>
        {cihaz && cihaz !== 'yonetim' && (
          <button type="button" onClick={() => git(ekranYolu(cihaz))} className="mt-3 min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text">
            {EKRAN_ADI[cihaz]} ekranına dön
          </button>
        )}
        <button type="button" onClick={() => { cikis(); git('/giris', { replace: true }) }} className="min-h-11 w-full rounded-lg text-[13px] text-muted underline underline-offset-4 hover:text-text">
          Çıkış yap
        </button>
      </form>
    </GirisKabugu>
  )
}
