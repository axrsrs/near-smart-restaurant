import { useState } from 'react'
import { fiyatCoz, fiyatYazi, tl } from '../lib/para'
import { indirimTutari, type IndirimIstegi, type IndirimTuru } from '../lib/veri'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET } from './bicim'

const TURLER: { kod: IndirimTuru; ad: string }[] = [
  { kod: 'yuzde', ad: '% indirim' },
  { kod: 'tutar', ad: '₺ indirim' },
  { kod: 'ikram', ad: 'İkram' },
  { kod: 'personel', ad: 'Personel' },
]
const HAZIR_YUZDE = [5, 10, 15, 20, 50]

/** Ödeme penceresinde indirim, ikram ya da personel yemeği seçimi. Sonucu sunucu yeniden hesaplar ve denetler. */
export default function IndirimPaneli({ brut, mevcut, uygula, kapat }: { brut: number; mevcut: IndirimIstegi | null; uygula: (i: IndirimIstegi | null) => void; kapat: () => void }) {
  const [tur, setTur] = useState<IndirimTuru>(mevcut?.tur ?? 'yuzde')
  const [deger, setDeger] = useState(() => (mevcut?.deger == null ? '' : mevcut.tur === 'tutar' ? fiyatYazi(mevcut.deger) : String(mevcut.deger)))
  const [aciklama, setAciklama] = useState(mevcut?.aciklama ?? '')
  const [hata, setHata] = useState('')

  const sayi = (): number | null => {
    if (tur === 'ikram') return null
    if (tur === 'tutar') return deger.trim() ? fiyatCoz(deger) : null
    if (!deger.trim()) return tur === 'personel' ? 100 : null
    return /^\d{1,3}$/.test(deger.trim()) ? Number(deger.trim()) : null
  }
  const istek: IndirimIstegi = { tur, deger: sayi(), aciklama }
  const tutar = indirimTutari(brut, istek)
  const gerekceGerekli = tur === 'ikram' || tur === 'personel'

  const onayla = () => {
    if (tutar === null) return setHata(tur === 'tutar' ? 'İndirim tutarı 0 ile sipariş tutarı arasında olmalı.' : 'Yüzde 1 ile 100 arasında olmalı.')
    if (gerekceGerekli && aciklama.trim().length < 2) return setHata(tur === 'ikram' ? 'Kime ya da neden ikram edildiğini yaz.' : 'Personelin adını yaz.')
    uygula(istek)
    kapat()
  }

  return (
    <div className="rounded-xl border border-line bg-ink p-3">
      <div role="radiogroup" aria-label="İndirim türü" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink-2 p-1 sm:grid-cols-4">
        {TURLER.map((t) => (
          <button key={t.kod} type="button" role="radio" aria-checked={tur === t.kod} onClick={() => { setTur(t.kod); setDeger(''); setHata('') }} className={`min-h-11 rounded-md text-sm font-semibold transition ${tur === t.kod ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}>
            {t.ad}
          </button>
        ))}
      </div>

      {tur === 'yuzde' && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Hazır yüzdeler">
          {HAZIR_YUZDE.map((y) => (
            <button key={y} type="button" aria-pressed={deger === String(y)} onClick={() => { setDeger(String(y)); setHata('') }} className={`min-h-11 min-w-14 rounded-full border px-3 text-sm font-semibold tabular-nums ${deger === String(y) ? 'border-gold bg-soft text-gold' : 'border-line text-muted'}`}>
              %{y}
            </button>
          ))}
        </div>
      )}
      {(tur === 'yuzde' || tur === 'tutar' || tur === 'personel') && (
        <div className="mt-3">
          <label htmlFor="indirim-deger" className={ETIKET}>{tur === 'tutar' ? 'İndirim tutarı (₺)' : tur === 'personel' ? 'İndirim yüzdesi (boşsa %100)' : 'İndirim yüzdesi'}</label>
          <input id="indirim-deger" value={deger} onChange={(e) => { setDeger(e.target.value); setHata('') }} inputMode="decimal" maxLength={tur === 'tutar' ? 12 : 3} autoComplete="off" placeholder={tur === 'tutar' ? 'Örnek: 25' : tur === 'personel' ? '100' : 'Örnek: 10'} className={`${ALAN} tabular-nums`} />
        </div>
      )}
      <div className="mt-3">
        <label htmlFor="indirim-aciklama" className={ETIKET}>
          {tur === 'ikram' ? 'Kime / neden' : tur === 'personel' ? 'Personelin adı' : 'Gerekçe'} {!gerekceGerekli && <span className="font-normal text-muted">(isteğe bağlı)</span>}
        </label>
        <input id="indirim-aciklama" value={aciklama} onChange={(e) => { setAciklama(e.target.value); setHata('') }} maxLength={80} autoComplete="off" placeholder={tur === 'ikram' ? 'Örnek: Doğum günü, müdavim' : tur === 'personel' ? 'Örnek: Murat' : 'Örnek: Öğrenci'} className={ALAN} />
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 text-[13px] tabular-nums">
        {hata ? <span className="text-danger">{hata}</span> : tutar !== null ? <span className="text-muted">İndirim {tl(tutar)} · Ödenecek <b className="font-semibold text-text">{tl(brut - tutar)}</b></span> : ''}
      </p>
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {mevcut ? (
          <button type="button" onClick={() => { uygula(null); kapat() }} className={BTN_IKINCIL}>İndirimi kaldır</button>
        ) : (
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
        )}
        <button type="button" onClick={onayla} className={BTN_ANA}>Uygula</button>
      </div>
    </div>
  )
}
