import { useEffect, useState } from 'react'
import Anahtar from '../../components/Anahtar'
import { BTN_ANA, BTN_IKINCIL } from '../../components/bicim'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import { KDV_ORANLARI, maliAyarKaydet, maliAyarOku, type KdvOrani } from '../../lib/veri'

/** Mali ayarlar: mali fiş takibi ve varsayılan KDV oranı. Ürüne özel oran Menü sekmesinden verilir. */
export default function MaliAyari() {
  const isletme = useSeciliIsletme()
  const [kayitli, setKayitli] = useState<{ kdv: KdvOrani; takip: boolean } | null>(null)
  const [kdv, setKdv] = useState<KdvOrani>(10)
  const [takip, setTakip] = useState(true)
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null)

  useEffect(() => {
    let iptal = false
    maliAyarOku(isletme.id)
      .then((a) => {
        if (iptal) return
        setKayitli({ kdv: a.kdv_varsayilan, takip: a.mali_takip })
        setKdv(a.kdv_varsayilan)
        setTakip(a.mali_takip)
      })
      .catch((e) => !iptal && setMesaj({ tur: 'hata', metin: hataMetni(e) }))
    return () => {
      iptal = true
    }
  }, [isletme.id])

  const degisti = kayitli !== null && (kayitli.kdv !== kdv || kayitli.takip !== takip)
  const kaydet = async () => {
    if (mesgul || !degisti) return
    setMesgul(true)
    setMesaj(null)
    const s = await maliAyarKaydet(isletme.id, kdv, takip)
    setMesgul(false)
    if (!s.tamam) return setMesaj({ tur: 'hata', metin: s.hata })
    setKayitli({ kdv, takip })
    setMesaj({ tur: 'ok', metin: 'Kaydedildi. Kasa birkaç saniye içinde yeni ayarla çalışır.' })
  }

  return (
    <section aria-labelledby="mali-baslik" className="mt-4 max-w-3xl rounded-2xl border border-line bg-ink-2 p-5">
      <h2 id="mali-baslik" className="text-lg font-semibold">Mali fiş ve KDV</h2>
      <p className="mt-1 text-sm text-muted">Tetra'nın fişi sipariş fişidir, mali değeri yoktur. Her satış için yazarkasa fişi ya da e-Arşiv fatura ayrıca kesilmelidir.</p>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-ink p-3 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Mali fiş takibi</p>
          <p className="text-[13px] text-muted">Kasiyer yazarkasa fişini kesince siparişi işaretler. Fişi kesilmemiş siparişler Raporlar'da listelenir.</p>
        </div>
        <Anahtar acik={takip} degistir={setTakip} etiket="Mali fiş takibi" />
      </div>

      <div className="mt-4">
        <p id="kdv-baslik" className="text-[15px] font-semibold">Varsayılan KDV oranı</p>
        <p className="text-[13px] text-muted">Oran verilmemiş bütün ürünlere uygulanır. Yeme-içme hizmetinde genel oran %10, alkollü içecekte %20'dir.</p>
        <div role="radiogroup" aria-labelledby="kdv-baslik" className="mt-2 grid max-w-sm grid-cols-3 gap-1 rounded-xl border border-line bg-ink p-1">
          {KDV_ORANLARI.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={kdv === o} onClick={() => setKdv(o)} className={`min-h-11 rounded-lg text-sm font-semibold tabular-nums transition ${kdv === o ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}>
              %{o}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[13px] text-muted">Oranlar değişebilir; işletmene uygun oranı mali müşavirinle teyit et. Değişiklik yeni siparişlere uygulanır, alınmış siparişler eski oranıyla kalır.</p>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={() => void kaydet()} disabled={!degisti || mesgul} className={BTN_ANA}>
          {mesgul ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={() => { if (kayitli) { setKdv(kayitli.kdv); setTakip(kayitli.takip) } setMesaj(null) }} disabled={!degisti || mesgul} className={BTN_IKINCIL}>
          Vazgeç
        </button>
      </div>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-[13px] ${mesaj?.tur === 'hata' ? 'text-danger' : 'text-ok'}`}>{mesaj?.metin ?? ''}</p>
    </section>
  )
}
