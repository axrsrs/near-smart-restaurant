import type { ReactNode } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ekranYolu, useCihaz, useOturum } from './lib/oturum'
import EkranBekliyor from './pages/EkranBekliyor'
import EkranSecimi from './pages/EkranSecimi'
import Giris from './pages/Giris'
import PinGiris from './pages/PinGiris'

function Korumali({ children }: { children: ReactNode }) {
  return useOturum() ? children : <Navigate to="/giris" replace />
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
        <Route path="/ekran" element={<Korumali><EkranSecimi /></Korumali>} />
        <Route path="/pin/:ekran" element={<PinGiris />} />
        <Route path="/kasa" element={<Korumali><EkranBekliyor ekran="kasa" /></Korumali>} />
        <Route path="/mutfak" element={<Korumali><EkranBekliyor ekran="mutfak" /></Korumali>} />
        <Route path="/tv" element={<Korumali><EkranBekliyor ekran="tv" /></Korumali>} />
        <Route path="/yonetim" element={<Korumali><EkranBekliyor ekran="yonetim" /></Korumali>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Yonlendirici>
  )
}
