import { useState } from 'react'
import { IKON_BTN } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import Onay from '../../components/Onay'
import { EKRAN_ADI } from '../../lib/oturum'
import { useListe } from '../../lib/useListe'
import { cihazListesi, cihazSil, type CihazKaydi } from '../../lib/veri'
import { useSeciliIsletme } from '../../lib/secili'

const zamanYazi = (z: string | null) => {
  if (!z) return 'Henüz bağlanmadı'
  const fark = Date.now() - Date.parse(z)
  if (fark < 10 * 60_000) return 'Şu an açık'
  return `Son görülme: ${new Date(z).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
}

/** İşletmeye tanıtılmış kasa, mutfak ve TV cihazları. Kaldırılan cihazın anahtarı anında geçersiz olur. */
export default function Cihazlar() {
  const isletme = useSeciliIsletme()
  const { liste, hata, yenile } = useListe(() => cihazListesi(isletme.id), isletme.id)
  const [silinecek, setSilinecek] = useState<CihazKaydi | null>(null)
  const [islemHata, setIslemHata] = useState('')

  return (
    <>
      <p className="text-sm text-muted">
        Yeni cihaz eklemek için o tablette ya da bilgisayarda giriş yap ve Ekran seçimi'nden Kasa, Mutfak ya da TV'yi seç. Kaybolan ya da artık kullanılmayan cihazı buradan kaldır.
      </p>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata || islemHata}</p>

      {liste === null ? (
        !hata && <p className="mt-6 text-center text-sm text-muted">Cihazlar yükleniyor…</p>
      ) : !liste.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-ink-2 p-6 text-center sm:p-10">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
            <Ikon ad="tablet" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Henüz tanıtılmış cihaz yok</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Kasa olacak cihazda giriş yapıp Ekran seçimi'nden Kasa'yı seçerek başla.</p>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {liste.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2 p-3 pl-4">
              <span className="grid size-11 flex-none place-items-center rounded-xl bg-soft text-gold">
                <Ikon ad={c.ekran} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{c.ad}</p>
                <p className="truncate text-[13px] text-muted">
                  {EKRAN_ADI[c.ekran]} · {zamanYazi(c.son_gorulme)}
                  {c.personel ? ` · ${c.personel}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setSilinecek(c)} aria-label={`${c.ad}: kaldır`} title="Cihazı kaldır" className={`${IKON_BTN} text-danger`}>
                <Ikon ad="cop" className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {silinecek && (
        <Onay
          baslik="Cihaz kaldırılsın mı?"
          metin={`"${silinecek.ad}" artık bu işletmenin ${EKRAN_ADI[silinecek.ekran]} ekranını açamayacak. Yeniden kullanmak için o cihazda giriş yapıp tekrar tanıtman gerekir.`}
          evet="Kaldır"
          onayla={async () => {
            const hedef = silinecek
            setSilinecek(null)
            const s = await cihazSil(isletme.id, hedef.id)
            setIslemHata(s.tamam ? '' : s.hata)
            yenile()
          }}
          kapat={() => setSilinecek(null)}
        />
      )}
    </>
  )
}
