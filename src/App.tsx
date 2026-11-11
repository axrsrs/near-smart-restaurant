import type { ReactNode } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { BTN_ANA, BTN_IKINCIL } from './components/bicim'
import { cihazYenile, EKRAN_ADI, PIN_ISTEYEN, useCihaz, useYonetici, type CihazEkrani, type Isletme } from './lib/oturum'
import EkranSecimi from './pages/EkranSecimi'
import Giris from './pages/Giris'
import Kasa from './pages/Kasa'
import Mutfak from './pages/Mutfak'
import PinGiris from './pages/PinGiris'
import Takip from './pages/Takip'
import Tv from './pages/Tv'
import Yonetim from './pages/Yonetim'
import Cihazlar from './pages/yonetim/Cihazlar'
import Isletme_ from './pages/yonetim/Isletme'
import Personel from './pages/yonetim/Personel'

const Bekle = () => (
  <div className="grid min-h-dvh place-items-center bg-ink" role="status" aria-label="Yükleniyor">
    <span className="size-7 animate-spin rounded-full border-2 border-text/30 border-t-text" />
  </div>
)

/** Yönetici ekranları: e-posta ve şifreyle giriş ister. */
function YoneticiSart({ children }: { children: ReactNode }) {
  const y = useYonetici()
  if (y.durum === 'yukleniyor') return <Bekle />
  return y.durum === 'var' ? children : <Navigate to="/giris" replace />
}

/** Cihaz ekranları: tanıtılmış cihaz ister; kasa ve mutfakta personel PIN'i girilmeden içerik açılmaz. */
function CihazSart({ ekran, children }: { ekran: CihazEkrani; children: (b: { isletme: Isletme; kanal: string; personel: { id: string; ad: string } | null }) => ReactNode }) {
  const c = useCihaz()
  const git = useNavigate()
  if (c.durum === 'yok') return <Navigate to="/" replace />
  if (c.ekran !== ekran) return <Navigate to={`/${c.ekran}`} replace />
  if (c.durum === 'yukleniyor') return <Bekle />
  if (c.durum === 'hata')
    return (
      <div className="grid min-h-dvh place-items-center bg-ink px-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-ink-2 p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{c.kapali ? `${EKRAN_ADI[ekran]} ekranı açılamıyor` : 'Sunucuya bağlanılamadı'}</h1>
          <p className="mt-2 text-sm text-muted">{c.hata}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button type="button" onClick={() => void cihazYenile()} className={BTN_ANA}>Yeniden dene</button>
            <button type="button" onClick={() => git('/giris')} className={BTN_IKINCIL}>Yönetici girişi</button>
          </div>
        </div>
      </div>
    )
  if (PIN_ISTEYEN.includes(ekran) && !c.personel) return <PinGiris ekran={ekran} isletme={c.isletme} personelTanimli={c.personelTanimli} />
  return children({ isletme: c.isletme, kanal: c.kanal, personel: c.personel })
}

/** Açılış: tanıtılmış cihaz kendi ekranına, giriş yapmış yönetici ekran seçimine, diğerleri girişe gider. */
function Acilis() {
  const c = useCihaz()
  const y = useYonetici()
  if (c.durum !== 'yok') return <Navigate to={`/${c.ekran}`} replace />
  if (y.durum === 'yukleniyor') return <Bekle />
  return <Navigate to={y.durum === 'var' ? '/ekran' : '/giris'} replace />
}

/* Tek dosyalık sürüm (npm run build:tek) adres çubuğu olmadan da çalışsın diye yolu bellekte tutar. */
const Yonlendirici = import.meta.env.VITE_TEK_DOSYA ? MemoryRouter : BrowserRouter

export default function App() {
  return (
    <Yonlendirici>
      <Routes>
        <Route path="/" element={<Acilis />} />
        <Route path="/giris" element={<Giris />} />
        <Route path="/ekran" element={<YoneticiSart><EkranSecimi /></YoneticiSart>} />
        <Route path="/yonetim" element={<YoneticiSart><Yonetim /></YoneticiSart>}>
          <Route index element={<Navigate to="personel" replace />} />
          <Route path="personel" element={<Personel />} />
          <Route path="cihazlar" element={<Cihazlar />} />
          <Route path="isletme" element={<Isletme_ />} />
        </Route>
        <Route path="/kasa" element={<CihazSart ekran="kasa">{(b) => (b.personel ? <Kasa isletme={b.isletme} personel={b.personel} kanal={b.kanal} /> : null)}</CihazSart>} />
        <Route path="/mutfak" element={<CihazSart ekran="mutfak">{(b) => (b.personel ? <Mutfak isletme={b.isletme} personel={b.personel} kanal={b.kanal} /> : null)}</CihazSart>} />
        <Route path="/tv" element={<CihazSart ekran="tv">{(b) => <Tv isletme={b.isletme} kanal={b.kanal} />}</CihazSart>} />
        <Route path="/t/:kod" element={<Takip />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Yonlendirici>
  )
}
