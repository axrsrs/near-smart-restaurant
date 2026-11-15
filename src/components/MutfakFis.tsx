import { createPortal } from 'react-dom'
import { TUR_ADI } from '../lib/etiketler'
import type { Siparis } from '../lib/veri'

/** 80 mm mutfak fişi: fiyat yok; büyük sipariş numarası, tür, ürünler ve notlar. Yalnızca yazdırırken basılır. */
export default function MutfakFis({ siparis, isletmeAd }: { siparis: Siparis; isletmeAd: string }) {
  const t = new Date(siparis.zaman)
  return createPortal(
    <div className="fis-kagit fis-mutfak" aria-hidden="true">
      <p className="fis-orta fis-kalin">MUTFAK · {isletmeAd}</p>
      <p className="fis-orta fis-no">{siparis.no}</p>
      <p className="fis-orta fis-tur">{TUR_ADI[siparis.tur].toLocaleUpperCase('tr')}</p>
      <p className="fis-orta fis-kucuk">
        {t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        {siparis.personelAd ? ` · ${siparis.personelAd}` : ''}
      </p>
      <hr />
      {siparis.kalemler.map((k, i) => (
        <div key={i} className="fis-mutfak-kalem">
          <p>
            <b>{k.adet} ×</b> {k.ad}
          </p>
          {k.secenekler.map((o, j) => (
            <p key={j} className="fis-mutfak-not">+ {o.ad}</p>
          ))}
          {k.not && <p className="fis-mutfak-not">» {k.not}</p>}
        </div>
      ))}
      <hr />
      <p className="fis-orta fis-kucuk">{siparis.kalemler.reduce((s, k) => s + k.adet, 0)} ürün</p>
    </div>,
    document.body,
  )
}
