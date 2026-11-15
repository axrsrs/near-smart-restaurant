import { useState } from 'react'
import type { Sonuc } from '../lib/oturum'
import type { MaliDurum } from '../lib/veri'
import { ALAN, BTN_ANA } from './bicim'
import Ikon from './Ikon'

const FIS_NO = /^[0-9A-Za-zÇĞİÖŞÜçğıöşü /.-]*$/
const saat = (z: number) => new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

/** Siparişin mali fiş (yazarkasa) durumu ve işareti. numarali: fiş numarası alanı da gösterilir (sipariş alındı penceresi).
    Yazarkasa entegrasyonu gelince bu işareti cihaz koyacak; şimdilik kasiyer yazarkasadan fişi kesip işaretler. */
export default function MaliFis({ mali, isaretle, numarali = false, kimlik }: { mali: MaliDurum; isaretle: (kesildi: boolean, fisNo: string) => Promise<Sonuc>; numarali?: boolean; kimlik: string }) {
  const [fisNo, setFisNo] = useState('')
  const [bekle, setBekle] = useState(false)
  const [hata, setHata] = useState('')
  if (!mali) return null

  const gonder = async (kesildi: boolean) => {
    if (bekle) return
    const no = fisNo.trim().replace(/\s+/g, ' ')
    if (kesildi && !FIS_NO.test(no)) return setHata('Fiş numarasında yalnızca harf, rakam, boşluk, / . - olabilir.')
    setBekle(true)
    setHata('')
    const s = await isaretle(kesildi, kesildi ? no : '')
    setBekle(false)
    if (!s.tamam) setHata(s.hata)
    else setFisNo('')
  }

  if (mali.durum === 'kesildi')
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1 font-semibold text-ok">
          <Ikon ad="tik" className="size-4" />
          Mali fiş kesildi
        </span>
        <span className="min-w-0 text-muted tabular-nums">
          {[mali.fisNo && `No ${mali.fisNo}`, mali.zaman && saat(mali.zaman), mali.kisi].filter(Boolean).join(' · ')}
        </span>
        <button type="button" disabled={bekle} onClick={() => void gonder(false)} className="-my-2 min-h-11 rounded-lg px-1 text-muted underline underline-offset-2 hover:text-text">
          Geri al
        </button>
        {hata && <p role="alert" className="basis-full text-danger">{hata}</p>}
      </div>
    )

  if (!numarali)
    return (
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="rounded-full border border-warn/60 px-2 py-0.5 text-xs font-semibold text-warn">Mali fiş bekliyor</span>
        <button type="button" disabled={bekle} onClick={() => void gonder(true)} className="-my-1.5 inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 font-semibold text-gold underline underline-offset-2">
          Fiş kesildi
        </button>
        {hata && <p role="alert" className="basis-full text-danger">{hata}</p>}
      </div>
    )

  return (
    <div className="rounded-xl border border-warn/50 bg-ink p-3">
      <p className="text-sm font-semibold text-warn">Mali fiş bekliyor</p>
      <p className="mt-0.5 text-[13px] text-muted">Yazarkasadan fişi kesince işaretle. Fiş numarası isteğe bağlıdır.</p>
      <div className="mt-2.5 flex gap-2">
        <input
          id={`mali-no-${kimlik}`}
          value={fisNo}
          onChange={(e) => { setFisNo(e.target.value); setHata('') }}
          maxLength={30}
          inputMode="text"
          autoComplete="off"
          placeholder="Fiş no"
          aria-label="Mali fiş numarası (isteğe bağlı)"
          className={`${ALAN} min-w-0 flex-1 tabular-nums`}
        />
        <button type="button" disabled={bekle} onClick={() => void gonder(true)} className={`${BTN_ANA} flex-none`}>
          <Ikon ad="tik" className="size-4" />
          Kesildi
        </button>
      </div>
      <p role="alert" aria-live="polite" className="mt-1 min-h-5 text-[13px] text-danger">{hata}</p>
    </div>
  )
}
