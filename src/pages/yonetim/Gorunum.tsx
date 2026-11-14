import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Anahtar from '../../components/Anahtar'
import { BTN_ANA, BTN_IKINCIL } from '../../components/bicim'
import { PALETLER, VARSAYILAN, gorunumUygula, paletRenkleri, type Gorunum, type PaletKodu } from '../../lib/gorunum'
import { gorunumGuncelle } from '../../lib/oturum'
import { useSeciliIsletme } from '../../lib/secili'
import { cagir, hataMetni } from '../../lib/sunucu'

/* sayfanın açık/koyu teması (palet kartlarındaki renkler buna göre gösterilir) */
const temaAbone = (f: () => void) => {
  const g = new MutationObserver(f)
  g.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => g.disconnect()
}
const useKoyu = () => useSyncExternalStore(temaAbone, () => document.documentElement.dataset.theme === 'dark')

/** İşletmenin görünümü: hazır palet + isteğe bağlı vurgu rengi. Seçim bu sayfada anında önizlenir; kaydedilince
    işletmenin bütün cihazları (kasa, mutfak, TV) ve müşteri takip sayfası yeni renge geçer. */
export default function GorunumAyari() {
  const isletme = useSeciliIsletme()
  const kayitli = isletme.gorunum ?? VARSAYILAN
  const [palet, setPalet] = useState<PaletKodu>(kayitli.palet)
  const [ozel, setOzel] = useState(Boolean(kayitli.vurgu))
  const [renk, setRenk] = useState(kayitli.vurgu ?? '#c2410c')
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null)
  const koyu = useKoyu()
  const vurgu = ozel ? renk.toLowerCase() : null
  const degisti = palet !== kayitli.palet || vurgu !== (kayitli.vurgu ?? null)

  // önizleme: seçim bu sayfaya hemen uygulanır (kaydedilmeden cihazda saklanmaz)
  useEffect(() => {
    gorunumUygula({ palet, vurgu }, false)
  }, [palet, vurgu])
  // sayfadan kaydetmeden çıkılırsa kayıtlı görünüme dönülür
  const kayitliRef = useRef(kayitli)
  useEffect(() => {
    kayitliRef.current = kayitli
  })
  useEffect(() => () => gorunumUygula(kayitliRef.current), [])

  const kaydet = async () => {
    if (mesgul || !degisti) return
    setMesgul(true)
    setMesaj(null)
    try {
      const y = await cagir<{ tamam: boolean; hata?: string }>('tetra_gorunum_kaydet', { p_restaurant: isletme.id, p_palet: palet, p_vurgu: vurgu })
      if (!y.tamam) throw new Error(y.hata ?? 'Görünüm kaydedilemedi.')
      const g: Gorunum = { palet, vurgu }
      gorunumGuncelle(isletme.id, g)
      gorunumUygula(g)
      setMesaj({ tur: 'ok', metin: 'Kaydedildi. Kasa, mutfak ve TV birkaç saniye içinde yeni görünüme geçer.' })
    } catch (e) {
      setMesaj({ tur: 'hata', metin: hataMetni(e) })
    } finally {
      setMesgul(false)
    }
  }
  const vazgec = () => {
    setPalet(kayitli.palet)
    setOzel(Boolean(kayitli.vurgu))
    setRenk(kayitli.vurgu ?? '#c2410c')
    setMesaj(null)
  }

  return (
    <section aria-labelledby="gorunum-baslik" className="mt-4 max-w-3xl rounded-2xl border border-line bg-ink-2 p-5">
      <h2 id="gorunum-baslik" className="text-lg font-semibold">Görünüm</h2>
      <p className="mt-1 text-sm text-muted">Seçtiğin renkler kasa, mutfak, salon TV'si, yönetim ve müşterinin sipariş takip sayfasında kullanılır. Açık ya da koyu tema her cihazda ayrı seçilir.</p>

      <div role="radiogroup" aria-label="Renk paleti" className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {PALETLER.map((p) => {
          const r = paletRenkleri(p.kod, vurgu, koyu)
          const secili = p.kod === palet
          return (
            <button
              key={p.kod}
              type="button"
              role="radio"
              aria-checked={secili}
              onClick={() => setPalet(p.kod)}
              className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-ink p-2.5 text-left transition active:scale-[0.98] ${secili ? 'border-gold ring-2 ring-gold/30' : 'border-line hover:border-text/40'}`}
            >
              <span aria-hidden="true" className="relative block h-14 overflow-hidden rounded-lg border border-line" style={{ background: r.zemin }}>
                <span className="absolute top-2 left-2 h-7 w-12 rounded-md" style={{ background: r.kart }} />
                <span className="absolute right-2 bottom-2 h-4 w-10 rounded-full" style={{ background: r.vurgu }} />
                <span className="absolute top-3 left-4 h-1.5 w-6 rounded-full opacity-70" style={{ background: r.yazi }} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.ad}</span>
                <span className="block truncate text-xs text-muted">{p.not}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-ink p-3 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Kendi vurgu rengim</p>
          <p className="text-[13px] text-muted">Düğmeler ve seçili sekmeler bu renkte olur; örneğin logonun rengi.</p>
        </div>
        <Anahtar acik={ozel} degistir={setOzel} etiket="Kendi vurgu rengini kullan" />
      </div>
      {ozel && (
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
          <label htmlFor="gorunum-renk" className="text-sm font-semibold">Vurgu rengi</label>
          <input id="gorunum-renk" type="color" value={renk} onChange={(e) => setRenk(e.target.value)} className="h-11 w-16 cursor-pointer rounded-[10px] border border-line bg-ink p-1" />
          <span className="font-mono text-sm text-muted uppercase">{renk}</span>
          <span className="basis-full text-xs text-muted">Zeminde okunmayacak kadar açık ya da koyu bir renk seçersen sistem onu okunur hâle getirir.</span>
        </div>
      )}

      <p className="mt-4 text-[13px] text-muted">{degisti ? 'Önizleme: bu sayfa seçtiğin renklerle görünüyor. Kaydedince bütün cihazlara uygulanır.' : 'Şu an kayıtlı görünüm kullanılıyor.'}</p>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={() => void kaydet()} disabled={!degisti || mesgul} className={BTN_ANA}>
          {mesgul ? 'Kaydediliyor…' : 'Görünümü kaydet'}
        </button>
        <button type="button" onClick={vazgec} disabled={!degisti || mesgul} className={BTN_IKINCIL}>
          Vazgeç
        </button>
      </div>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-[13px] ${mesaj?.tur === 'hata' ? 'text-danger' : 'text-ok'}`}>
        {mesaj?.metin ?? ''}
      </p>
    </section>
  )
}
