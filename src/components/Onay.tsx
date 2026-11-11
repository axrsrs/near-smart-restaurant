import { BTN_IKINCIL, BTN_TEHLIKE } from './bicim'
import Pencere from './Pencere'

export default function Onay({ baslik, metin, evet, onayla, kapat }: { baslik: string; metin: string; evet: string; onayla: () => void; kapat: () => void }) {
  return (
    <Pencere baslik={baslik} kapat={kapat}>
      <p className="text-sm text-muted">{metin}</p>
      <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <button type="button" data-ilk onClick={kapat} className={BTN_IKINCIL}>
          Vazgeç
        </button>
        <button type="button" onClick={onayla} className={BTN_TEHLIKE}>
          {evet}
        </button>
      </div>
    </Pencere>
  )
}
