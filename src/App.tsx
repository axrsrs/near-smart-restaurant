import type { ReactNode } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import YoneticiKilidi from './components/YoneticiKilidi'
import { ekranYolu, useCihaz, useOturum, useYoneticiAcik } from './lib/oturum'
import EkranBekliyor from './pages/EkranBekliyor'
import EkranSecimi from './pages/EkranSecimi'
import Giris from './pages/Giris'
import Kasa from './pages/Kasa'
import Takip from './pages/Takip'
import PinGiris from './pages/PinGiris'
import Yonetim from './pages/Yonetim'
import Isletme from './pages/yonetim/Isletme'
import Personel from './pages/yonetim/Personel'


function Korumali({ children }: { children: ReactNode }) {
  return useOturum() ? children : <Navigate to="/giris" replace />
}

/** Ekran seçimi ve Yönetim: giriş yetmez; cihaz kasa/mutfak/TV'ye geçtiyse yönetici şifresi yeniden sorulur. */
function Yonetici({ children }: { children: ReactNode }) {
  const oturum = useOturum()
  const acik = useYoneticiAcik()
  if (!oturum) return <Navigate to="/giris" replace />
  return acik ? children : <YoneticiKilidi />
}

/** Açılış: giriş yoksa girişe, cihaz seçilmişse doğrudan o ekrana, değilse ekran seçimine. */
function Acilis() {
  const oturum = useOturum()
  const cihaz = useCihaz()
  if (!oturum) return <Navigate to="/giris" replace />
  return <Navigate to={cihaz ? ekranYolu(cihaz) : '/ekran'} replace />
}

/* Tek dosyalık sürüm (npm run build:tek) adres çubuğu olmadan da çalışsın diye yolu bellekte tutar. */
const Yonlendirici = import.meta.env.VITE_TEK_DOSYA ? MemoryRouter : BrowserRouter

export default function App() {
  return (
    <Yonlendirici>
      <Routes>
        <Route path="/" element={<Acilis />} />
        <Route path="/giris" element={<Giris />} />
        <Route path="/ekran" element={<Yonetici><EkranSecimi /></Yonetici>} />
        <Route path="/pin/:ekran" element={<PinGiris />} />
        <Route path="/kasa" element={<Korumali><Kasa /></Korumali>} />
        <Route path="/t/:kod" element={<Takip />} />
        <Route path="/mutfak" element={<Korumali><EkranBekliyor ekran="mutfak" /></Korumali>} />
        <Route path="/tv" element={<Korumali><EkranBekliyor ekran="tv" /></Korumali>} />
        <Route path="/yonetim" element={<Yonetici><Yonetim /></Yonetici>}>
          <Route index element={<Navigate to="personel" replace />} />
          <Route path="personel" element={<Personel />} />
          <Route path="isletme" element={<Isletme />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Yonlendirici>
  )
}
