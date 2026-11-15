import { useState } from 'react'
import Anahtar from '../../components/Anahtar'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET, IKON_BTN } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import Onay from '../../components/Onay'
import Pencere from '../../components/Pencere'
import type { MenuKategori } from '../../lib/menu'
import { fiyatCoz, fiyatYazi, tl } from '../../lib/para'
import { grupKaydet, grupSil, type GrupTaslak, type SecenekGrup, type SecenekVeri } from '../../lib/secenek'

type SatirTaslak = { anahtar: number; id?: string; ad: string; fiyat: string; varsayilan: boolean; aktif: boolean }
let sayac = 0
const satir = (ad = '', fiyat = 0, varsayilan = false): SatirTaslak => ({ anahtar: ++sayac, ad, fiyat: fiyat ? fiyatYazi(fiyat) : '', varsayilan, aktif: true })

const SABLONLAR: { ad: string; not: string; taslak: () => Omit<Duzenleme, 'urunler'> }[] = [
  { ad: 'Boy', not: 'Küçük / Orta / Büyük · tek seçim, zorunlu', taslak: () => ({ ad: 'Boy', tur: 'tek', zorunlu: true, en_fazla: '', satirlar: [satir('Küçük', 0, true), satir('Orta', 1500), satir('Büyük', 3000)] }) },
  { ad: 'Ekstralar', not: 'Ekstra peynir, sos… · fiyatlı, çoklu', taslak: () => ({ ad: 'Ekstralar', tur: 'coklu', zorunlu: false, en_fazla: '', satirlar: [satir('Ekstra peynir', 2000), satir('Ekstra sos', 1000)] }) },
  { ad: 'Çıkarılsın', not: 'Soğansız, turşusuz… · ücretsiz, çoklu', taslak: () => ({ ad: 'Çıkarılsın', tur: 'coklu', zorunlu: false, en_fazla: '', satirlar: [satir('Soğansız'), satir('Turşusuz'), satir('Sossuz')] }) },
]

type Duzenleme = { id?: string; ad: string; tur: 'tek' | 'coklu'; zorunlu: boolean; en_fazla: string; satirlar: SatirTaslak[]; urunler: string[] }

/** Seçenek grupları: boy, ekstralar, çıkarılacaklar. Grup birden çok ürüne bağlanabilir; değişiklik kasaya hemen yansır. */
export default function SecenekGruplari({ isletme, veri, kategoriler, yenile }: { isletme: string; veri: SecenekVeri; kategoriler: MenuKategori[]; yenile: () => void }) {
  const [duzen, setDuzen] = useState<Duzenleme | null>(null)
  const [silinecek, setSilinecek] = useState<SecenekGrup | null>(null)
  const [hata, setHata] = useState('')
  const bagliSayisi = (grupId: string) => Object.values(veri.urunler).filter((l) => l.includes(grupId)).length

  const ac = (g: SecenekGrup) =>
    setDuzen({
      id: g.id, ad: g.ad, tur: g.tur, zorunlu: g.zorunlu, en_fazla: g.en_fazla ? String(g.en_fazla) : '',
      satirlar: g.secenekler.map((s) => ({ anahtar: ++sayac, id: s.id, ad: s.ad, fiyat: s.fiyat ? fiyatYazi(s.fiyat) : '', varsayilan: s.varsayilan, aktif: s.aktif })),
      urunler: Object.entries(veri.urunler).filter(([, l]) => l.includes(g.id)).map(([u]) => u),
    })

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted">Boy, ekstra malzeme ya da çıkarılacaklar gibi seçenekler. Bir grubu birden çok ürüne bağlayabilirsin; kasada ürüne dokununca seçim penceresi açılır. QR menüde görünmez.</p>
        <button type="button" onClick={() => setDuzen({ ad: '', tur: 'coklu', zorunlu: false, en_fazla: '', satirlar: [satir()], urunler: [] })} className={BTN_ANA}>
          <Ikon ad="arti" className="size-4" />
          Grup ekle
        </button>
      </div>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata}</p>

      {!veri.gruplar.length ? (
        <div className="rounded-2xl border border-dashed border-line bg-ink-2 p-5">
          <p className="text-[15px] font-semibold">Henüz seçenek grubu yok</p>
          <p className="mt-1 text-sm text-muted">Hazır bir şablonla başla; adları ve fiyatları kaydetmeden önce değiştirebilirsin.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SABLONLAR.map((s) => (
              <button key={s.ad} type="button" onClick={() => setDuzen({ ...s.taslak(), urunler: [] })} className="rounded-xl border border-line bg-ink p-3 text-left transition hover:border-text/40 active:scale-[0.98]">
                <span className="block text-[15px] font-semibold">{s.ad}</span>
                <span className="block text-xs text-muted">{s.not}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {veri.gruplar.map((g) => (
            <li key={g.id} className="flex items-start gap-2 rounded-2xl border border-line bg-ink-2 p-3 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{g.ad}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                  <span className="rounded-full bg-soft px-2 py-0.5 text-gold">{g.tur === 'tek' ? 'Tek seçim' : g.en_fazla ? `En fazla ${g.en_fazla}` : 'Çoklu seçim'}</span>
                  {g.zorunlu && <span className="rounded-full border border-line px-2 py-0.5 text-muted">Zorunlu</span>}
                  <span className="rounded-full border border-line px-2 py-0.5 text-muted">{bagliSayisi(g.id)} ürün</span>
                </p>
                <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">
                  {g.secenekler.map((s) => `${s.ad}${s.fiyat ? ` +${tl(s.fiyat)}` : ''}${s.aktif ? '' : ' (kapalı)'}`).join(' · ')}
                </p>
              </div>
              <button type="button" onClick={() => ac(g)} aria-label={`${g.ad}: düzenle`} title="Düzenle" className={IKON_BTN}>
                <Ikon ad="kalem" className="size-[18px]" />
              </button>
              <button type="button" onClick={() => setSilinecek(g)} aria-label={`${g.ad}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                <Ikon ad="cop" className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {duzen && <GrupFormu isletme={isletme} ilk={duzen} kategoriler={kategoriler} kapat={() => setDuzen(null)} kaydedildi={() => { setDuzen(null); yenile() }} />}
      {silinecek && (
        <Onay
          baslik="Grup silinsin mi?"
          metin={`"${silinecek.ad}" grubu ve seçenekleri silinecek; bağlı ${bagliSayisi(silinecek.id)} üründen de kalkar. Geçmiş siparişler etkilenmez.`}
          evet="Sil"
          onayla={async () => {
            const g = silinecek
            setSilinecek(null)
            const s = await grupSil(isletme, g.id)
            setHata(s.tamam ? '' : s.hata)
            yenile()
          }}
          kapat={() => setSilinecek(null)}
        />
      )}
    </>
  )
}

function GrupFormu({ isletme, ilk, kategoriler, kapat, kaydedildi }: { isletme: string; ilk: Duzenleme; kategoriler: MenuKategori[]; kapat: () => void; kaydedildi: () => void }) {
  const [d, setD] = useState<Duzenleme>(ilk)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)
  const secili = new Set(d.urunler)
  const yaz = (p: Partial<Duzenleme>) => { setD((o) => ({ ...o, ...p })); setHata('') }
  const satirYaz = (anahtar: number, p: Partial<SatirTaslak>) =>
    yaz({ satirlar: d.satirlar.map((s) => (s.anahtar === anahtar ? { ...s, ...p } : p.varsayilan && d.tur === 'tek' ? { ...s, varsayilan: false } : s)) })
  const urunDegistir = (ids: string[], ekle: boolean) => {
    const y = new Set(d.urunler)
    ids.forEach((id) => (ekle ? y.add(id) : y.delete(id)))
    yaz({ urunler: [...y] })
  }

  const kaydet = async () => {
    if (bekle) return
    if (!d.ad.trim()) return setHata('Grup adını yaz.')
    const dolu = d.satirlar.filter((s) => s.ad.trim())
    if (!dolu.length) return setHata('En az bir seçenek ekle.')
    const secenekler: GrupTaslak['secenekler'] = []
    for (const s of dolu) {
      const fiyat = s.fiyat.trim() ? fiyatCoz(s.fiyat) : 0
      if (fiyat === null) return setHata(`"${s.ad.trim()}" için geçerli bir fiyat yaz. Örnek: 15 ya da 12,50`)
      secenekler.push({ id: s.id, ad: s.ad.trim(), fiyat, varsayilan: s.varsayilan, aktif: s.aktif })
    }
    const enFazla = d.tur === 'coklu' && d.en_fazla.trim() ? Number(d.en_fazla) : null
    if (enFazla !== null && (!Number.isInteger(enFazla) || enFazla < 1 || enFazla > 30)) return setHata('En fazla seçim 1–30 arasında olmalı.')
    setBekle(true)
    const s = await grupKaydet(isletme, { id: d.id, ad: d.ad.trim(), tur: d.tur, zorunlu: d.zorunlu, en_fazla: enFazla, secenekler, urunler: d.urunler })
    setBekle(false)
    if (s.tamam) kaydedildi()
    else setHata(s.hata)
  }

  return (
    <Pencere baslik={d.id ? 'Seçenek grubunu düzenle' : 'Seçenek grubu ekle'} kapat={kapat}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="grup-ad" className={ETIKET}>Grup adı</label>
          <input id="grup-ad" value={d.ad} onChange={(e) => yaz({ ad: e.target.value })} maxLength={40} autoComplete="off" placeholder="Örnek: Boy, Ekstralar, Çıkarılsın" className={ALAN} />
        </div>
        <div>
          <p id="grup-tur" className={ETIKET}>Seçim</p>
          <div role="radiogroup" aria-labelledby="grup-tur" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink p-1">
            {([['tek', 'Tek seçim'], ['coklu', 'Birden çok']] as const).map(([k, ad]) => (
              <button key={k} type="button" role="radio" aria-checked={d.tur === k} onClick={() => yaz({ tur: k, satirlar: k === 'tek' ? d.satirlar.map((s, i) => ({ ...s, varsayilan: s.varsayilan && d.satirlar.findIndex((x) => x.varsayilan) === i })) : d.satirlar })} className={`min-h-11 rounded-lg text-sm font-semibold transition ${d.tur === k ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}>
                {ad}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-ink p-2 pl-3.5">
          <span className="min-w-0 flex-1 text-sm">
            <b className="block font-semibold">Zorunlu</b>
            <span className="text-muted">{d.tur === 'tek' ? 'Kasiyer bir seçenek seçmeden ürünü ekleyemez (ör. boy).' : 'En az bir seçenek seçilmeli.'}</span>
          </span>
          <Anahtar acik={d.zorunlu} degistir={(v) => yaz({ zorunlu: v })} etiket="Zorunlu" />
        </div>
        {d.tur === 'coklu' && (
          <div>
            <label htmlFor="grup-en-fazla" className={ETIKET}>En fazla seçim <span className="font-normal text-muted">(boşsa sınırsız)</span></label>
            <input id="grup-en-fazla" value={d.en_fazla} onChange={(e) => yaz({ en_fazla: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" autoComplete="off" placeholder="Örnek: 3" className={`${ALAN} max-w-32 tabular-nums`} />
          </div>
        )}

        <fieldset>
          <legend className={ETIKET}>Seçenekler</legend>
          <ul className="flex flex-col gap-2">
            {d.satirlar.map((s, i) => (
              <li key={s.anahtar} className="rounded-xl border border-line bg-ink p-2.5">
                <div className="flex gap-2">
                  <input value={s.ad} onChange={(e) => satirYaz(s.anahtar, { ad: e.target.value })} maxLength={40} autoComplete="off" placeholder={`Seçenek ${i + 1}`} aria-label={`Seçenek ${i + 1} adı`} className={`${ALAN} min-w-0 flex-1`} />
                  <input value={s.fiyat} onChange={(e) => satirYaz(s.anahtar, { fiyat: e.target.value })} inputMode="decimal" maxLength={10} autoComplete="off" placeholder="+0 ₺" aria-label={`Seçenek ${i + 1} fiyat farkı (₺)`} className={`${ALAN} w-24 flex-none tabular-nums`} />
                  <button type="button" onClick={() => yaz({ satirlar: d.satirlar.filter((x) => x.anahtar !== s.anahtar) })} disabled={d.satirlar.length === 1} aria-label={`Seçenek ${i + 1}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                    <Ikon ad="cop" className="size-[18px]" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-1 text-[13px]">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={s.varsayilan} onChange={(e) => satirYaz(s.anahtar, { varsayilan: e.target.checked })} className="size-4 accent-[var(--color-gold)]" />
                    Hazır seçili gelsin
                  </label>
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={!s.aktif} onChange={(e) => satirYaz(s.anahtar, { aktif: !e.target.checked })} className="size-4 accent-[var(--color-warn)]" />
                    Şu an yok (kasada seçilemez)
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => yaz({ satirlar: [...d.satirlar, satir()] })} disabled={d.satirlar.length >= 40} className={`${BTN_IKINCIL} mt-2 w-full`}>
            <Ikon ad="arti" className="size-4" />
            Seçenek ekle
          </button>
        </fieldset>

        <fieldset>
          <legend className={ETIKET}>Hangi ürünlerde? <span className="font-normal text-muted">({d.urunler.length} ürün seçili)</span></legend>
          <div className="flex flex-col gap-3">
            {kategoriler.filter((k) => k.urunler.length).map((k) => {
              const ids = k.urunler.map((u) => u.id)
              const hepsi = ids.every((id) => secili.has(id))
              return (
                <div key={k.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-wider text-muted uppercase">{k.ad}</p>
                    <button type="button" onClick={() => urunDegistir(ids, !hepsi)} className="min-h-9 rounded-lg px-2 text-[13px] font-semibold text-gold underline underline-offset-2">
                      {hepsi ? 'Hiçbiri' : 'Tümü'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {k.urunler.map((u) => {
                      const acik = secili.has(u.id)
                      return (
                        <button key={u.id} type="button" role="checkbox" aria-checked={acik} onClick={() => urunDegistir([u.id], !acik)} className={`min-h-10 rounded-full border px-3 text-[13px] font-semibold transition ${acik ? 'border-gold bg-soft text-gold' : 'border-line bg-ink text-muted'}`}>
                          {u.ad}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>

        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="button" disabled={bekle} onClick={() => void kaydet()} className={BTN_ANA}>{bekle ? 'Kaydediliyor' : 'Kaydet'}</button>
        </div>
      </div>
    </Pencere>
  )
}
