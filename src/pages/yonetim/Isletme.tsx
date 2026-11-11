import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import { isletmeKaydet, useIsletme } from '../../lib/veri'

const EN_BUYUK_DOSYA = 5 * 1024 * 1024
const EN_BUYUK_KENAR = 640

/** Logoyu okur; 640 pikselden büyükse oranını bozmadan küçültür (saydamlık korunur). */
function logoOku(dosya: File): Promise<string> {
  return new Promise((coz, red) => {
    const adres = URL.createObjectURL(dosya)
    const resim = new Image()
    resim.onload = () => {
      URL.revokeObjectURL(adres)
      const oran = Math.min(1, EN_BUYUK_KENAR / Math.max(resim.naturalWidth, resim.naturalHeight))
      const tuval = document.createElement('canvas')
      tuval.width = Math.max(1, Math.round(resim.naturalWidth * oran))
      tuval.height = Math.max(1, Math.round(resim.naturalHeight * oran))
      const cx = tuval.getContext('2d')
      if (!cx) return red(new Error('tuval'))
      cx.drawImage(resim, 0, 0, tuval.width, tuval.height)
      coz(tuval.toDataURL('image/png'))
    }
    resim.onerror = () => {
      URL.revokeObjectURL(adres)
      red(new Error('resim'))
    }
    resim.src = adres
  })
}

export default function Isletme() {
  const kayitli = useIsletme()
  const [ad, setAd] = useState(kayitli.ad)
  const [sube, setSube] = useState(kayitli.sube)
  const [logo, setLogo] = useState(kayitli.logo)
  const [hata, setHata] = useState('')
  const [kaydedildi, setKaydedildi] = useState(false)
  const dosya = useRef<HTMLInputElement>(null)
  const degisti = ad !== kayitli.ad || sube !== kayitli.sube || logo !== kayitli.logo

  const sec = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setKaydedildi(false)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return setHata('Logo PNG, JPG ya da WebP olmalı.')
    if (f.size > EN_BUYUK_DOSYA) return setHata('Logo dosyası en fazla 5 MB olabilir.')
    try {
      setLogo(await logoOku(f))
      setHata('')
    } catch {
      setHata('Logo dosyası okunamadı.')
    }
  }

  const gonder = (e: FormEvent) => {
    e.preventDefault()
    const s = isletmeKaydet({ ad, sube, logo })
    setHata(s.tamam ? '' : s.hata)
    setKaydedildi(s.tamam)
  }

  return (
    <form onSubmit={gonder} noValidate className="max-w-xl rounded-2xl border border-line bg-ink-2 p-5">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="isletme-ad" className={ETIKET}>İşletme adı</label>
          <input id="isletme-ad" value={ad} onChange={(e) => { setAd(e.target.value); setKaydedildi(false) }} maxLength={60} autoComplete="organization" className={ALAN} />
        </div>
        <div>
          <label htmlFor="isletme-sube" className={ETIKET}>Şube <span className="font-normal text-muted">(isteğe bağlı)</span></label>
          <input id="isletme-sube" value={sube} onChange={(e) => { setSube(e.target.value); setKaydedildi(false) }} maxLength={60} autoComplete="off" placeholder="Örnek: Merkez şube" className={ALAN} />
        </div>
        <div>
          <span className={ETIKET}>Logo</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-20 w-36 flex-none place-items-center rounded-xl border border-line bg-ink p-2">
              {logo ? <img src={logo} alt="Logo önizlemesi" className="max-h-full max-w-full object-contain" /> : <Ikon ad="resim" className="size-7 text-text/30" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <input ref={dosya} id="isletme-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={sec} className="sr-only" tabIndex={-1} aria-label="Logo dosyası" />
              <button type="button" onClick={() => dosya.current?.click()} className={BTN_IKINCIL}>
                {logo ? 'Logoyu değiştir' : 'Logo yükle'}
              </button>
              {logo && (
                <button type="button" onClick={() => { setLogo(null); setKaydedildi(false) }} className={`${BTN_IKINCIL} text-danger`}>
                  Kaldır
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">Üst barda, PIN ekranında ve TV ekranında görünür. Saydam zeminli PNG en iyi sonucu verir.</p>
        </div>
      </div>
      <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-[13px] ${hata ? 'text-danger' : 'text-ok'}`}>
        {hata || (kaydedildi ? 'Kaydedildi.' : '')}
      </p>
      <button type="submit" disabled={!degisti} className={`${BTN_ANA} mt-1 w-full sm:w-auto`}>
        Kaydet
      </button>
    </form>
  )
}
