import { useCallback, useEffect, useState } from 'react'
import { ALAN, ETIKET } from '../../components/bicim'
import MaliFis from '../../components/MaliFis'
import { ODEME_ADI } from '../../lib/etiketler'
import { tl } from '../../lib/para'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import { gunSonuListe, maliBekleyenler, maliIsaretleSahip, raporOku, type GunSonu, type Rapor, type Siparis } from '../../lib/veri'

const iso = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
const gunOnce = (n: number) => {
  const t = new Date()
  t.setDate(t.getDate() - n)
  return iso(t)
}
const HAZIR: { ad: string; aralik: () => [string, string] }[] = [
  { ad: 'Bugün', aralik: () => [gunOnce(0), gunOnce(0)] },
  { ad: 'Dün', aralik: () => [gunOnce(1), gunOnce(1)] },
  { ad: 'Son 7 gün', aralik: () => [gunOnce(6), gunOnce(0)] },
  { ad: 'Son 30 gün', aralik: () => [gunOnce(29), gunOnce(0)] },
  { ad: 'Bu ay', aralik: () => [iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), gunOnce(0)] },
]
const gunYazi = (g: string) => new Date(`${g}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })

/** Satış raporu: seçilen tarih aralığında özet, günlük döküm ve en çok satan ürünler. İptaller ciroya girmez. */
export default function Raporlar() {
  const isletme = useSeciliIsletme()
  const [secim, setSecim] = useState('Bugün')
  const [bas, setBas] = useState(gunOnce(0))
  const [bit, setBit] = useState(gunOnce(0))
  const [rapor, setRapor] = useState<Rapor | null>(null)
  const [hata, setHata] = useState('')
  const [yuklenen, setYuklenen] = useState('')
  const [tazele, setTazele] = useState(0) // mali fiş işaretlenince rapor yeniden okunur
  const [kapanislar, setKapanislar] = useState<GunSonu[]>([])

  useEffect(() => {
    if (!bas || !bit || bit < bas) return
    let iptal = false
    gunSonuListe(isletme.id, bas, bit).then((l) => !iptal && setKapanislar(l), () => !iptal && setKapanislar([]))
    return () => {
      iptal = true
    }
  }, [isletme.id, bas, bit])
  const anahtar = `${isletme.id}|${bas}|${bit}`
  const bekle = yuklenen !== anahtar // seçilen aralığın raporu henüz gelmedi

  useEffect(() => {
    if (!bas || !bit || bit < bas) return
    let iptal = false
    raporOku(isletme.id, bas, bit)
      .then((r) => {
        if (iptal) return
        setRapor(r)
        setYuklenen(`${isletme.id}|${bas}|${bit}`)
        setHata('')
      })
      .catch((e) => !iptal && setHata(hataMetni(e)))
    return () => {
      iptal = true
    }
  }, [isletme.id, bas, bit, tazele])

  const o = rapor?.ozet
  const ortalama = o && o.siparis ? Math.round(o.ciro / o.siparis) : 0
  const kutular: [string, string][] = o
    ? [
        ['Ciro', tl(o.ciro)],
        ['Sipariş', String(o.siparis)],
        ['Ortalama sipariş', tl(ortalama)],
        ['Nakit', tl(o.nakit)],
        ['Kart', tl(o.kart)],
        ['Burada / Paket', `${o.burada} / ${o.paket}`],
        ['İptal', String(o.iptal)],
        ...(rapor?.mali ? [['Mali fiş bekleyen', rapor.mali.bekleyen ? `${rapor.mali.bekleyen} · ${tl(rapor.mali.bekleyen_tutar)}` : 'Yok'] as [string, string]] : []),
      ]
    : []
  const enCok = Math.max(1, ...(rapor?.urunler.map((u) => u.ciro) ?? [1]))

  const kdv = rapor?.kdv ?? []
  const toplamFark = kapanislar.reduce((t, k) => t + (k.fark ?? 0), 0)
  return (
    <>
      <MaliBekleyenler isletme={isletme.id} degisti={() => setTazele((n) => n + 1)} />
      <div className="-mx-4 overflow-x-auto px-4" role="group" aria-label="Tarih aralığı">
        <div className="flex w-max gap-2 pb-1">
          {[...HAZIR.map((h) => h.ad), 'Özel'].map((ad) => (
            <button
              key={ad}
              type="button"
              aria-pressed={secim === ad}
              onClick={() => {
                setSecim(ad)
                const h = HAZIR.find((x) => x.ad === ad)
                if (h) {
                  const [b, e] = h.aralik()
                  setBas(b)
                  setBit(e)
                }
              }}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${secim === ad ? 'border-text bg-text text-ink' : 'border-line bg-ink-2 text-muted hover:text-text'}`}
            >
              {ad}
            </button>
          ))}
        </div>
      </div>
      {secim === 'Özel' && (
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <div>
            <label htmlFor="rapor-bas" className={ETIKET}>Başlangıç</label>
            <input id="rapor-bas" type="date" value={bas} max={gunOnce(0)} onChange={(e) => setBas(e.target.value)} className={`${ALAN} bg-ink-2`} />
          </div>
          <div>
            <label htmlFor="rapor-bit" className={ETIKET}>Bitiş</label>
            <input id="rapor-bit" type="date" value={bit} max={gunOnce(0)} onChange={(e) => setBit(e.target.value)} className={`${ALAN} bg-ink-2`} />
          </div>
        </div>
      )}
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{bas && bit && bit < bas ? 'Bitiş tarihi başlangıçtan önce olamaz.' : hata}</p>

      {!rapor ? (
        !hata && <p className="mt-6 text-center text-sm text-muted">Rapor hazırlanıyor…</p>
      ) : (
        <div className={bekle ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {kutular.map(([ad, deger], i) => (
              <div key={ad} className={`rounded-2xl border border-line bg-ink-2 p-4 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <dt className="text-[13px] text-muted">{ad}</dt>
                <dd className={`mt-0.5 truncate font-semibold tracking-tight tabular-nums ${i === 0 ? 'text-3xl' : 'text-xl'}`}>{deger}</dd>
              </div>
            ))}
          </dl>

          {!o?.siparis && !o?.iptal ? (
            <p className="mt-8 text-center text-sm text-muted">Bu tarih aralığında sipariş yok.</p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {kdv.length > 0 && (
                <section className="lg:col-span-2">
                  <h2 className="mb-2.5 text-[13px] font-semibold tracking-wider text-muted uppercase">KDV kırılımı</h2>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {kdv.map((k) => (
                      <li key={k.oran} className="rounded-xl border border-line bg-ink-2 p-3">
                        <div className="flex items-baseline gap-3">
                          <span className="min-w-0 flex-1 text-[15px] font-semibold">KDV %{k.oran}</span>
                          <span className="flex-none text-[15px] font-semibold tabular-nums">{tl(k.tutar)}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted tabular-nums">Matrah {tl(k.tutar - k.kdv)} · KDV {tl(k.kdv)}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Bilgi amaçlıdır; satış fiyatları KDV dahil kabul edilerek hesaplanır. Resmî kayıt yazarkasa Z raporu ve e-Arşiv faturalardır.</p>
                </section>
              )}
              <section>
                <h2 className="mb-2.5 text-[13px] font-semibold tracking-wider text-muted uppercase">En çok satanlar</h2>
                <ol className="flex flex-col gap-2">
                  {rapor.urunler.map((u) => (
                    <li key={u.ad} className="rounded-xl border border-line bg-ink-2 p-3">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{u.ad}</span>
                        <span className="flex-none text-sm text-muted tabular-nums">{u.adet} adet</span>
                        <span className="flex-none text-[15px] font-semibold tabular-nums">{tl(u.ciro)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-3" aria-hidden="true">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, (u.ciro / enCok) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2 className="mb-2.5 text-[13px] font-semibold tracking-wider text-muted uppercase">Günlük döküm</h2>
                <ul className="flex flex-col gap-2">
                  {rapor.gunler.map((g) => (
                    <li key={g.gun} className="rounded-xl border border-line bg-ink-2 p-3">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{gunYazi(g.gun)}</span>
                        <span className="flex-none text-[15px] font-semibold tabular-nums">{tl(g.ciro)}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted tabular-nums">
                        {g.siparis} sipariş · Nakit {tl(g.nakit)} · Kart {tl(g.kart)}
                        {g.iptal ? ` · ${g.iptal} iptal` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
          {kapanislar.length > 0 && (
            <section className="mt-6">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3">
                <h2 className="min-w-0 flex-1 text-[13px] font-semibold tracking-wider text-muted uppercase">Gün sonu kayıtları ve kasa sayımı</h2>
                {kapanislar.some((k) => k.fark !== null) && (
                  <span className={`text-[13px] font-semibold tabular-nums ${toplamFark === 0 ? 'text-ok' : 'text-warn'}`}>
                    Toplam fark: {toplamFark === 0 ? 'yok' : toplamFark > 0 ? `+${tl(toplamFark)}` : `−${tl(-toplamFark)}`}
                  </span>
                )}
              </div>
              <ul className="grid gap-2 lg:grid-cols-2">
                {kapanislar.map((k) => (
                  <li key={k.id} className="rounded-xl border border-line bg-ink-2 p-3">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                        {gunYazi(k.gun)} · {new Date(k.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`flex-none text-[15px] font-semibold tabular-nums ${k.fark === null ? 'text-muted' : k.fark === 0 ? 'text-ok' : 'text-warn'}`}>
                        {k.fark === null ? 'Sayım yok' : k.fark === 0 ? 'Tam' : k.fark > 0 ? `+${tl(k.fark)}` : `−${tl(-k.fark)}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted tabular-nums">
                      {k.personel_ad} · Beklenen {tl(k.beklenen_nakit)}{k.sayilan_nakit !== null ? ` · Sayılan ${tl(k.sayilan_nakit)}` : ''} · Ciro {tl(k.ozet.ciro)}
                    </p>
                    {k.aciklama && <p className="mt-0.5 text-[13px]">Not: {k.aciklama}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}

const gunSaat = (s: Siparis) =>
  `${new Date(`${s.gun}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${new Date(s.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`

/** Fişi kesilmemiş siparişler (son 90 gün). Sahip buradan da işaretleyebilir; liste boşsa hiç görünmez. */
function MaliBekleyenler({ isletme, degisti }: { isletme: string; degisti: () => void }) {
  const [liste, setListe] = useState<Siparis[] | null>(null)
  const [acik, setAcik] = useState(false)
  const [hata, setHata] = useState('')
  const yukle = useCallback(() => {
    maliBekleyenler(isletme).then(
      (l) => { setListe(l); setHata('') },
      (e) => setHata(hataMetni(e)),
    )
  }, [isletme])
  useEffect(() => {
    yukle()
  }, [yukle])

  if (hata) return <p role="alert" className="mb-3 text-[13px] text-danger">{hata}</p>
  if (!liste?.length) return null
  const tutar = liste.reduce((t, s) => t + s.toplam, 0)
  return (
    <section aria-labelledby="mali-bekleyen-baslik" className="mb-5 rounded-2xl border border-warn/50 bg-ink-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="mali-bekleyen-baslik" className="min-w-0 flex-1 text-[15px] font-semibold text-warn">
          Mali fişi kesilmemiş {liste.length >= 300 ? '300+' : liste.length} sipariş · {tl(tutar)}
        </h2>
        <button type="button" aria-expanded={acik} onClick={() => setAcik((v) => !v)} className="-my-1 min-h-11 rounded-lg px-2 text-sm font-semibold underline underline-offset-2">
          {acik ? 'Gizle' : 'Listeyi göster'}
        </button>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">Yazarkasadan fişi kesilen siparişleri işaretle. Kesilmemiş satış vergi cezasına yol açabilir.</p>
      {acik && (
        <ul className="mt-3 flex flex-col gap-2">
          {liste.map((s) => (
            <li key={s.id} className="rounded-xl border border-line bg-ink p-3">
              <div className="flex items-baseline gap-3">
                <span className="w-10 flex-none text-center text-lg font-bold tabular-nums">{s.no}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{gunSaat(s)} · {ODEME_ADI[s.odeme]} · {s.personelAd || 'Kasa'}</span>
                <span className="flex-none text-[15px] font-semibold tabular-nums">{tl(s.toplam)}</span>
              </div>
              <div className="mt-1 pl-13">
                <MaliFis
                  mali={s.mali}
                  kimlik={s.id}
                  isaretle={async (k, n) => {
                    const r = await maliIsaretleSahip(isletme, s.id, k, n)
                    if (r.tamam) { setListe((l) => l?.filter((x) => x.id !== s.id) ?? l); degisti() }
                    return r
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
