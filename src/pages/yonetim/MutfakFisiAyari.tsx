import { useEffect, useState } from 'react'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import { maliAyarOku, mutfakFisiKaydet, type MutfakFisiYeri } from '../../lib/veri'

const SECENEKLER: { kod: MutfakFisiYeri; ad: string; not: string }[] = [
  { kod: 'kapali', ad: 'Kapalı', not: 'Mutfak siparişi yalnızca mutfak ekranında görür.' },
  { kod: 'kasa', ad: 'Kasada bas', not: 'Sipariş alınınca müşteri fişinin ardından fiyatsız mutfak fişi de kasadaki yazıcıdan çıkar.' },
  { kod: 'mutfak', ad: 'Mutfakta bas', not: 'Yeni sipariş mutfak ekranına düşünce mutfak cihazına bağlı yazıcıdan otomatik çıkar.' },
]

/** Mutfak fişi: kapalı, kasada ya da mutfakta. Seçince hemen kaydedilir; cihazlar birkaç saniyede geçer. */
export default function MutfakFisiAyari() {
  const isletme = useSeciliIsletme()
  const [secili, setSecili] = useState<MutfakFisiYeri | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null)

  useEffect(() => {
    let iptal = false
    maliAyarOku(isletme.id).then(
      (a) => !iptal && setSecili(a.mutfak_fisi ?? 'kapali'),
      (e) => !iptal && setMesaj({ tur: 'hata', metin: hataMetni(e) }),
    )
    return () => {
      iptal = true
    }
  }, [isletme.id])

  const sec = async (kod: MutfakFisiYeri) => {
    if (mesgul || kod === secili) return
    const eski = secili
    setSecili(kod)
    setMesgul(true)
    setMesaj(null)
    const s = await mutfakFisiKaydet(isletme.id, kod)
    setMesgul(false)
    if (s.tamam) setMesaj({ tur: 'ok', metin: 'Kaydedildi. Kasa ve mutfak birkaç saniye içinde yeni ayarla çalışır.' })
    else {
      setSecili(eski)
      setMesaj({ tur: 'hata', metin: s.hata })
    }
  }

  return (
    <section aria-labelledby="mutfak-fisi-baslik" className="mt-4 max-w-3xl rounded-2xl border border-line bg-ink-2 p-5">
      <h2 id="mutfak-fisi-baslik" className="text-lg font-semibold">Mutfak fişi</h2>
      <p className="mt-1 text-sm text-muted">Fiyatsız fiş: büyük sipariş numarası, burada ya da paket, ürünler ve notlar. 80 mm termal yazıcıya göre hazırlanır.</p>
      <div role="radiogroup" aria-labelledby="mutfak-fisi-baslik" className="mt-4 flex flex-col gap-2">
        {SECENEKLER.map((x) => {
          const aktif = secili === x.kod
          return (
            <button
              key={x.kod}
              type="button"
              role="radio"
              aria-checked={aktif}
              disabled={secili === null}
              onClick={() => void sec(x.kod)}
              className={`flex min-h-14 items-center gap-3 rounded-xl border bg-ink px-4 py-2.5 text-left transition disabled:opacity-60 ${aktif ? 'border-gold ring-2 ring-gold/30' : 'border-line hover:border-text/40'}`}
            >
              <span className={`grid size-5 flex-none place-items-center rounded-full border-2 ${aktif ? 'border-gold' : 'border-line'}`}>{aktif && <span className="size-2.5 rounded-full bg-gold" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{x.ad}</span>
                <span className="block text-[13px] text-muted">{x.not}</span>
              </span>
            </button>
          )
        })}
      </div>
      {secili === 'mutfak' && (
        <p className="mt-3 rounded-xl border border-line bg-ink px-3 py-2 text-[13px] text-muted">
          Pencere açılmadan basması için mutfak cihazı Windows olmalı ve Tetra, Kurulum Rehberi'ndeki yazdırma kısayoluyla açılmalı. Tablette her siparişte "Yazdır"a bir kez dokunmak gerekir. Yazıcısı olmayan ikinci bir mutfak ekranında, ekranın üstündeki yazıcı düğmesiyle otomatik fiş kapatılabilir.
        </p>
      )}
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-[13px] ${mesaj?.tur === 'hata' ? 'text-danger' : 'text-ok'}`}>{mesgul ? 'Kaydediliyor…' : (mesaj?.metin ?? '')}</p>
    </section>
  )
}
