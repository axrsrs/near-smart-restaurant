import { useEffect, useState } from 'react'
import { ALAN, ETIKET } from '../../components/bicim'
import { tl } from '../../lib/para'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import { raporOku, type Rapor } from '../../lib/veri'

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
  }, [isletme.id, bas, bit])

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
      ]
    : []
  const enCok = Math.max(1, ...(rapor?.urunler.map((u) => u.ciro) ?? [1]))

  return (
    <>
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
        </div>
      )}
    </>
  )
}
