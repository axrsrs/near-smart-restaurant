import { useEffect, useState } from 'react'
import { fiyatCoz, tl } from '../lib/para'
import { hataMetni } from '../lib/sunucu'
import { gunSonuKaydet, gunSonuOku, INDIRIM_ADI, type GunOzeti, type GunSonu } from '../lib/veri'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET } from './bicim'
import Ikon from './Ikon'
import Pencere from './Pencere'

const saat = (z: string | null) => (z ? new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '–')
export type GunSonuBaski = { ozet: GunOzeti; kapanis?: GunSonu }

/** Kasada gün sonu: günün özeti, isteğe bağlı kasa sayımı (fark kaydedilir) ve 80 mm rapor fişi. */
export default function GunSonuPenceresi({ yazdir, kapat }: { yazdir: (b: GunSonuBaski) => void; kapat: () => void }) {
  const [veri, setVeri] = useState<{ ozet: GunOzeti; kapanislar: GunSonu[] } | null>(null)
  const [hata, setHata] = useState('')
  const [sayim, setSayim] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [bekle, setBekle] = useState(false)
  const [son, setSon] = useState<GunSonu | null>(null)

  const yukle = () =>
    gunSonuOku().then(
      (v) => { setVeri(v); setHata('') },
      (e) => setHata(hataMetni(e)),
    )
  useEffect(() => {
    void yukle()
  }, [])

  const o = veri?.ozet
  const sayilan = sayim.trim() ? fiyatCoz(sayim) : null
  const sayimHatali = sayim.trim() !== '' && sayilan === null
  const fark = o && sayilan !== null ? sayilan - o.nakit : null

  const kaydet = async () => {
    if (bekle || !o || sayimHatali) return
    setBekle(true)
    setHata('')
    const s = await gunSonuKaydet(sayilan, aciklama)
    setBekle(false)
    if (!s.tamam || !s.kapanis) return setHata(s.tamam ? 'Gün sonu kaydedilemedi.' : s.hata)
    setSon(s.kapanis)
    setSayim('')
    setAciklama('')
    yazdir({ ozet: s.kapanis.ozet, kapanis: s.kapanis })
    void yukle()
  }

  return (
    <Pencere baslik="Gün sonu" kapat={() => !bekle && kapat()}>
      {!o ? (
        <p className="py-6 text-center text-sm text-muted">{hata || 'Gün özeti hazırlanıyor…'}</p>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {new Date(`${o.gun}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })} · ilk {saat(o.ilk)}, son {saat(o.son)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {[['Ciro', tl(o.ciro)], ['Sipariş', String(o.siparis)], ['Nakit', tl(o.nakit)], ['Kart', tl(o.kart)]].map(([a, b], i) => (
              <div key={a} className="rounded-xl border border-line bg-ink px-3 py-2.5">
                <dt className="text-xs text-muted">{a}</dt>
                <dd className={`truncate font-semibold tabular-nums ${i === 0 ? 'text-xl' : 'text-[15px]'}`}>{b}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-ink px-3 text-[13px]">
            <li className="flex justify-between gap-3 py-2"><span className="text-muted">Burada / Paket</span><span className="tabular-nums">{o.burada} / {o.paket}</span></li>
            <li className="py-2">
              <div className="flex justify-between gap-3"><span className="text-muted">İptal ({o.iptal.adet})</span><span className="tabular-nums">{tl(o.iptal.tutar)}</span></div>
              {o.iptal.liste.length > 0 && <p className="mt-0.5 text-xs text-muted">{o.iptal.liste.map((x) => `No ${x.no}${x.kisi ? ` (${x.kisi})` : ''}`).join(', ')}</p>}
            </li>
            {o.indirim && o.indirim.adet > 0 && (
              <li className="py-2">
                <div className="flex justify-between gap-3"><span className="text-muted">İndirim ve ikram ({o.indirim.adet})</span><span className="tabular-nums">{tl(o.indirim.tutar)}</span></div>
                <p className="mt-0.5 text-xs text-muted">{o.indirim.liste.map((x) => `No ${x.no} ${INDIRIM_ADI[x.tur].toLocaleLowerCase('tr')}${x.kisi ? ` (${x.kisi})` : ''}`).join(', ')}</p>
              </li>
            )}
            {o.personel.map((p) => (
              <li key={p.ad} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate text-muted">{p.ad} · {p.siparis} sipariş</span><span className="flex-none tabular-nums">{tl(p.ciro)}</span></li>
            ))}
            {o.kdv.map((k) => (
              <li key={k.oran} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate text-muted">%{k.oran} KDV'li satış · KDV {tl(k.kdv)}</span><span className="flex-none tabular-nums">{tl(k.tutar)}</span></li>
            ))}
          </ul>
          {o.mali.bekleyen > 0 && (
            <p className="mt-2 rounded-xl border border-warn/50 bg-ink px-3 py-2 text-[13px] text-warn">
              <b className="font-semibold">{o.mali.bekleyen} siparişin</b> mali fişi kesilmedi ({tl(o.mali.tutar)}). Gün sonundan önce yazarkasadan kes.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line bg-ink p-3">
            <p className="text-sm font-semibold">Kasa sayımı <span className="font-normal text-muted">(isteğe bağlı)</span></p>
            <p className="mt-0.5 text-[13px] text-muted">Kasada olması gereken nakit: <b className="font-semibold text-text tabular-nums">{tl(o.nakit)}</b></p>
            <label htmlFor="gs-sayim" className={`${ETIKET} mt-3`}>Çekmecedeki nakit (₺)</label>
            <input id="gs-sayim" value={sayim} onChange={(e) => setSayim(e.target.value)} inputMode="decimal" maxLength={14} autoComplete="off" placeholder="Örnek: 4.250" className={`${ALAN} tabular-nums`} />
            <p aria-live="polite" className={`mt-1.5 min-h-5 text-[13px] font-semibold ${sayimHatali ? 'text-danger' : fark === null ? 'text-muted' : fark === 0 ? 'text-ok' : 'text-warn'}`}>
              {sayimHatali ? 'Geçerli bir tutar yaz.' : fark === null ? '' : fark === 0 ? 'Kasa tam.' : fark > 0 ? `${tl(fark)} fazla` : `${tl(-fark)} eksik`}
            </p>
            <label htmlFor="gs-not" className={ETIKET}>Not <span className="font-normal text-muted">(isteğe bağlı)</span></label>
            <input id="gs-not" value={aciklama} onChange={(e) => setAciklama(e.target.value)} maxLength={200} autoComplete="off" placeholder="Örnek: 50 ₺ bozuk para için alındı" className={ALAN} />
          </div>

          <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata}</p>
          {son && <p role="status" className="mb-2 text-[13px] text-ok">Gün sonu {saat(son.zaman)} itibarıyla kaydedildi ve yazdırıldı.</p>}
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button type="button" data-ilk disabled={bekle || sayimHatali} onClick={() => void kaydet()} className={`${BTN_ANA} sm:flex-1`}>
              <Ikon ad="tik" className="size-4" />
              {bekle ? 'Kaydediliyor…' : 'Gün sonunu kaydet ve yazdır'}
            </button>
            <button type="button" disabled={bekle} onClick={() => yazdir({ ozet: o })} className={BTN_IKINCIL}>
              <Ikon ad="yazici" className="size-4" />
              Ara rapor yazdır
            </button>
          </div>

          {veri.kapanislar.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[13px] font-semibold text-muted">Bugünkü gün sonu kayıtları</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {veri.kapanislar.map((k) => (
                  <li key={k.id} className="flex items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{saat(k.zaman)} · {k.personel_ad} · nakit {tl(k.beklenen_nakit)}</span>
                    <span className={`flex-none font-semibold tabular-nums ${k.fark === null ? 'text-muted' : k.fark === 0 ? 'text-ok' : 'text-warn'}`}>
                      {k.fark === null ? 'Sayım yok' : k.fark === 0 ? 'Tam' : k.fark > 0 ? `+${tl(k.fark)}` : `−${tl(-k.fark)}`}
                    </span>
                    <button type="button" onClick={() => yazdir({ ozet: k.ozet, kapanis: k })} aria-label={`${saat(k.zaman)} gün sonunu yeniden yazdır`} title="Yeniden yazdır" className="-my-1 grid size-11 flex-none place-items-center rounded-lg text-muted hover:text-text">
                      <Ikon ad="yazici" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Pencere>
  )
}
