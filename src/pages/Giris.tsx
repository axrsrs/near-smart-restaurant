import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import logo from '../assets/near-logo.png'
import GirisKabugu from '../components/GirisKabugu'
import Ikon from '../components/Ikon'
import { girisYap, useOturum } from '../lib/oturum'

const ALAN =
  'h-12 w-full min-w-0 rounded-[10px] border border-transparent bg-text/6 pl-11 text-base text-text outline-none transition placeholder:text-text/40 focus:border-gold focus:ring-3 focus:ring-gold/20'

export default function Giris() {
  const oturum = useOturum()
  const git = useNavigate()
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [goster, setGoster] = useState(false)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)

  if (oturum) return <Navigate to="/" replace />

  const gonder = async (e: FormEvent) => {
    e.preventDefault()
    if (bekle) return
    setHata('')
    setBekle(true)
    const s = await girisYap(eposta, sifre)
    setBekle(false)
    if (s.tamam) git('/', { replace: true })
    else setHata(s.hata)
  }

  return (
    <GirisKabugu>
      <form onSubmit={gonder} noValidate>
        <img src={logo} alt="NEAR Agency" width={560} height={146} className="near-logo mx-auto mb-3.5 h-[34px] w-auto" />
        <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Tetra</p>
        <h1 className="mb-1.5 text-center text-[22px] leading-tight font-semibold tracking-tight">İşletme girişi</h1>
        <p className="mb-6 text-center text-[13px] text-muted">Kasa, mutfak ve ekranlar için giriş yapın</p>

        <div className="flex flex-col gap-3">
          <label className="relative flex items-center text-text/45 focus-within:text-text">
            <Ikon ad="eposta" className="pointer-events-none absolute left-3.5 size-4" />
            <input
              id="giris-eposta"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="E-posta"
              aria-label="E-posta"
              maxLength={254}
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              className={`${ALAN} pr-3.5`}
            />
          </label>
          <div className="relative flex items-center text-text/45 focus-within:text-text">
            <Ikon ad="kilit" className="pointer-events-none absolute left-3.5 size-4" />
            <input
              id="giris-sifre"
              type={goster ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Şifre"
              aria-label="Şifre"
              maxLength={128}
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className={`${ALAN} pr-12`}
            />
            <button
              type="button"
              aria-label={goster ? 'Şifreyi gizle' : 'Şifreyi göster'}
              aria-pressed={goster}
              onClick={() => setGoster((g) => !g)}
              className="absolute right-0.5 grid size-11 place-items-center rounded-lg text-text/50 hover:text-text"
            >
              <Ikon ad={goster ? 'goz' : 'gozKapali'} className="size-[18px]" />
            </button>
          </div>

          <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">
            {hata}
          </p>

          <button
            type="submit"
            disabled={bekle}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-text text-[15px] font-semibold text-ink transition hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-80"
          >
            {bekle && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            <span>{bekle ? 'Giriş yapılıyor' : 'Giriş yap'}</span>
            {!bekle && <Ikon ad="ok" className="size-3.5 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </form>
    </GirisKabugu>
  )
}
