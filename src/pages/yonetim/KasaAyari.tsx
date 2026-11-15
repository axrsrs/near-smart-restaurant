import { useEffect, useState } from 'react'
import { isletmeGorunumu, KASA_GORUNUMLERI, type KasaGorunum } from '../../lib/kasaGorunum'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import { kasaGorunumKaydet, maliAyarOku } from '../../lib/veri'

/* küçük önizleme: her görünümün kasada nasıl durduğu */
function Onizleme({ kod }: { kod: KasaGorunum }) {
  if (kod === 'liste')
    return (
      <span aria-hidden="true" className="grid h-14 grid-cols-2 content-start gap-1 rounded-lg border border-line bg-ink-2 p-1.5">
        {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-2.5 rounded-sm bg-text/25" />)}
      </span>
    )
  const n = kod === 'kucuk' ? 12 : 6
  return (
    <span aria-hidden="true" className={`grid h-14 gap-1 rounded-lg border border-line bg-ink-2 p-1.5 ${kod === 'kucuk' ? 'grid-cols-6' : 'grid-cols-3'}`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className="rounded-sm bg-text/30" />)}
    </span>
  )
}

/** Kasa ekranı: bütün kasalar için varsayılan ürün görünümü. Seçince hemen kaydedilir; kasalar birkaç saniyede geçer. */
export default function KasaAyari() {
  const isletme = useSeciliIsletme()
  const [secili, setSecili] = useState<KasaGorunum | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null)

  useEffect(() => {
    let iptal = false
    maliAyarOku(isletme.id).then(
      (a) => !iptal && setSecili(isletmeGorunumu(a.kasa_gorunum)),
      (e) => !iptal && setMesaj({ tur: 'hata', metin: hataMetni(e) }),
    )
    return () => {
      iptal = true
    }
  }, [isletme.id])

  const sec = async (kod: KasaGorunum) => {
    if (mesgul || kod === secili) return
    const eski = secili
    setSecili(kod)
    setMesgul(true)
    setMesaj(null)
    const s = await kasaGorunumKaydet(isletme.id, kod)
    setMesgul(false)
    if (s.tamam) setMesaj({ tur: 'ok', metin: 'Kaydedildi. Kasalar birkaç saniye içinde yeni görünüme geçer.' })
    else {
      setSecili(eski)
      setMesaj({ tur: 'hata', metin: s.hata })
    }
  }

  return (
    <section aria-labelledby="kasa-ayar-baslik" className="mt-4 max-w-3xl rounded-2xl border border-line bg-ink-2 p-5">
      <h2 id="kasa-ayar-baslik" className="text-lg font-semibold">Kasa ekranı</h2>
      <p className="mt-1 text-sm text-muted">Ürünlerin kasada nasıl görüneceğini seç. Bütün kasalara uygulanır; kasiyer kendi cihazında ürün görünümü düğmesinden değiştirebilir.</p>
      <div role="radiogroup" aria-labelledby="kasa-ayar-baslik" className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {KASA_GORUNUMLERI.map((g) => {
          const aktif = secili === g.kod
          return (
            <button
              key={g.kod}
              type="button"
              role="radio"
              aria-checked={aktif}
              disabled={secili === null}
              onClick={() => void sec(g.kod)}
              className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-ink p-2.5 text-left transition active:scale-[0.98] disabled:opacity-60 ${aktif ? 'border-gold ring-2 ring-gold/30' : 'border-line hover:border-text/40'}`}
            >
              <Onizleme kod={g.kod} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{g.ad}</span>
                <span className="block text-xs text-muted">{g.not}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-[13px] ${mesaj?.tur === 'hata' ? 'text-danger' : 'text-ok'}`}>{mesgul ? 'Kaydediliyor…' : (mesaj?.metin ?? '')}</p>
    </section>
  )
}
