import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Anahtar from '../components/Anahtar'
import { ALAN } from '../components/bicim'
import Ikon from '../components/Ikon'
import UstBar from '../components/UstBar'
import { useYonetici, yoneticiYenile } from '../lib/oturum'
import { paketAyarla } from '../lib/veri'

const kucuk = (s: string) => s.toLocaleLowerCase('tr')

/** Süper yönetici: hangi işletmede Tetra paketi açık. Paketi kapatmak cihazları anında durdurur; veriler silinmez. */
export default function Paketler() {
  const git = useNavigate()
  const y = useYonetici()
  const [arama, setArama] = useState('')
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [hata, setHata] = useState('')
  if (y.durum !== 'var') return null
  if (!y.isletmeler.some((i) => i.rol === 'super')) return <Navigate to="/ekran" replace />

  const liste = y.isletmeler.filter((i) => !arama.trim() || kucuk(i.ad).includes(kucuk(arama.trim())) || i.slug.includes(arama.trim().toLowerCase()))
  const acik = y.isletmeler.filter((i) => i.tetra).length

  return (
    <div className="min-h-dvh bg-ink">
      <UstBar />
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => git('/ekran')} className="mb-3 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm text-muted hover:text-text">
          <Ikon ad="geri" className="size-4" />
          Ekran seçimi
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Paketler</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {y.isletmeler.length} işletmenin {acik} tanesinde Tetra açık. Anahtarı açınca işletme "Menü + Tetra" paketine geçer; kapatınca cihazları durur, kayıtları silinmez.
        </p>
        <label className="relative mt-4 flex items-center text-text/45 focus-within:text-text">
          <Ikon ad="ara" className="pointer-events-none absolute left-3.5 size-4" />
          <input id="paket-ara" type="search" placeholder="İşletme ara" aria-label="İşletme ara" maxLength={60} value={arama} onChange={(e) => setArama(e.target.value)} className={`${ALAN} bg-ink-2 pl-10`} />
        </label>
        <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata}</p>
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {liste.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2 p-3 pl-4">
              <span className="grid h-10 w-14 flex-none place-items-center">{i.logo ? <img src={i.logo} alt="" className="max-h-full max-w-full object-contain" /> : <Ikon ad="dukkan" className="size-5 text-text/40" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{i.ad}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                  <span className="truncate">neardiji.com/{i.slug}</span>
                  {!i.abonelik && <span className="rounded-full border border-warn/50 px-2 text-xs font-semibold text-warn">Abonelik kapalı</span>}
                </p>
              </div>
              <span className={`hidden text-xs font-semibold sm:block ${i.tetra ? 'text-gold' : 'text-muted'}`}>{i.tetra ? 'Menü + Tetra' : 'Menü'}</span>
              <span className={mesgul === i.id ? 'opacity-50' : ''}>
                <Anahtar
                  acik={i.tetra}
                  etiket={i.tetra ? `${i.ad}: Tetra paketini kapat` : `${i.ad}: Tetra paketini aç`}
                  degistir={async (v) => {
                    if (mesgul) return
                    setMesgul(i.id)
                    const s = await paketAyarla(i.id, v)
                    setHata(s.tamam ? '' : s.hata)
                    await yoneticiYenile()
                    setMesgul(null)
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
        {!liste.length && <p className="mt-6 text-center text-sm text-muted">Eşleşen işletme yok.</p>}
      </main>
    </div>
  )
}
