import { useMemo, useState } from 'react'
import type { MenuUrun } from '../lib/menu'
import { tl } from '../lib/para'
import { secimHatasi, secimler, varsayilanSecim, type Secim, type SecenekGrup } from '../lib/secenek'
import { BTN_ANA } from './bicim'
import Ikon from './Ikon'
import Pencere from './Pencere'

/** Kasada seçenekli ürün eklerken açılır: boy (tek seçim), ekstralar ve çıkarılacaklar (çoklu seçim). Fiyat anında güncellenir. */
export default function SecenekPenceresi({ urun, gruplar, ekle, kapat }: { urun: MenuUrun; gruplar: SecenekGrup[]; ekle: (s: Secim[]) => void; kapat: () => void }) {
  const [secili, setSecili] = useState<Set<string>>(() => varsayilanSecim(gruplar))
  const [denendi, setDenendi] = useState(false)
  const hata = secimHatasi(gruplar, secili)
  const ek = useMemo(() => secimler(gruplar, secili).reduce((t, s) => t + s.fiyat, 0), [gruplar, secili])

  const degistir = (g: SecenekGrup, id: string) =>
    setSecili((o) => {
      const y = new Set(o)
      if (g.tur === 'tek') {
        const zatenSecili = y.has(id)
        g.secenekler.forEach((s) => y.delete(s.id))
        if (!zatenSecili || g.zorunlu) y.add(id) // zorunlu tek seçimde seçim kaldırılamaz
      } else if (y.has(id)) y.delete(id)
      else {
        const n = g.secenekler.filter((s) => y.has(s.id)).length
        if (g.en_fazla && n >= g.en_fazla) return o
        y.add(id)
      }
      return y
    })

  const onayla = () => {
    setDenendi(true)
    if (hata) return
    ekle(secimler(gruplar, secili))
  }

  return (
    <Pencere baslik={urun.ad} kapat={kapat}>
      <p className="-mt-2 mb-3 text-sm text-muted tabular-nums">Fiyat {tl(urun.fiyat)}</p>
      <div className="flex flex-col gap-4">
        {gruplar.map((g) => {
          const n = g.secenekler.filter((s) => secili.has(s.id)).length
          const eksik = denendi && g.zorunlu && n === 0
          return (
            <fieldset key={g.id} className={`rounded-xl border p-3 ${eksik ? 'border-danger' : 'border-line'}`}>
              <legend className="flex flex-wrap items-baseline gap-x-2 px-1">
                <span className="text-[15px] font-semibold">{g.ad}</span>
                <span className={`text-xs ${eksik ? 'font-semibold text-danger' : 'text-muted'}`}>
                  {g.zorunlu ? 'Zorunlu' : 'İsteğe bağlı'}
                  {g.tur === 'tek' ? ' · tek seçim' : g.en_fazla ? ` · en fazla ${g.en_fazla}` : ' · birden çok seçilebilir'}
                </span>
              </legend>
              <div role={g.tur === 'tek' ? 'radiogroup' : 'group'} aria-label={g.ad} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.secenekler.map((s) => {
                  const acik = secili.has(s.id)
                  const dolu = g.tur === 'coklu' && !acik && Boolean(g.en_fazla) && n >= (g.en_fazla ?? 0)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role={g.tur === 'tek' ? 'radio' : 'checkbox'}
                      aria-checked={acik}
                      disabled={dolu}
                      onClick={() => degistir(g, s.id)}
                      className={`flex min-h-12 items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left transition active:scale-[0.98] disabled:opacity-40 ${acik ? 'border-gold bg-soft' : 'border-line bg-ink'}`}
                    >
                      <span className={`grid size-5 flex-none place-items-center border-2 ${g.tur === 'tek' ? 'rounded-full' : 'rounded-md'} ${acik ? 'border-gold bg-gold text-on-gold' : 'border-line'}`}>
                        {acik && (g.tur === 'tek' ? <span className="size-2 rounded-full bg-on-gold" /> : <Ikon ad="tik" className="size-3.5" />)}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-medium">{s.ad}</span>
                      {s.fiyat > 0 && <span className="flex-none text-sm text-muted tabular-nums">+{tl(s.fiyat)}</span>}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )
        })}
      </div>
      <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-[13px] text-danger">{denendi ? (hata ?? '') : ''}</p>
      <button type="button" data-ilk onClick={onayla} className={`${BTN_ANA} h-14 w-full justify-between px-5 text-base`}>
        <span>Sepete ekle</span>
        <span className="tabular-nums">{tl(urun.fiyat + ek)}</span>
      </button>
    </Pencere>
  )
}
