import { createPortal } from 'react-dom'
import { ODEME_ADI, takipAdresi, TUR_ADI } from '../lib/etiketler'
import { tl } from '../lib/para'
import { INDIRIM_ADI, type Siparis } from '../lib/veri'
import QrKod from './QrKod'


/** 80 mm termal yazıcı fişi. Ekranda görünmez; yalnızca yazdırırken basılır (bkz. index.css → .fis-kagit). */
export default function Fis({ siparis, isletmeAd }: { siparis: Siparis; isletmeAd: string }) {
  const t = new Date(siparis.zaman)
  return createPortal(
    <div className="fis-kagit" aria-hidden="true">
      <p className="fis-orta fis-kalin fis-buyuk">{isletmeAd}</p>
      <p className="fis-orta">{t.toLocaleDateString('tr-TR')} {t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
      <hr />
      <p className="fis-orta">SİPARİŞ NO</p>
      <p className="fis-orta fis-no">{siparis.no}</p>
      <p className="fis-orta fis-kalin">{TUR_ADI[siparis.tur].toLocaleUpperCase('tr')}</p>
      <hr />
      {siparis.kalemler.map((k, i) => (
        <div key={i} className="fis-satir">
          <span>
            {k.adet} × {k.ad}
            {k.not && <em>Not: {k.not}</em>}
          </span>
          <span>{tl(k.fiyat * k.adet)}</span>
        </div>
      ))}
      <hr />
      {siparis.indirim && (
        <>
          <div className="fis-satir">
            <span>Ara toplam</span>
            <span>{tl(siparis.indirim.brut)}</span>
          </div>
          <div className="fis-satir">
            <span>
              {INDIRIM_ADI[siparis.indirim.tur]}
              {siparis.indirim.tur === 'yuzde' || (siparis.indirim.tur === 'personel' && (siparis.indirim.deger ?? 100) < 100) ? ` %${siparis.indirim.deger}` : ''}
              {siparis.indirim.aciklama && <em>{siparis.indirim.aciklama}</em>}
            </span>
            <span>−{tl(siparis.indirim.tutar)}</span>
          </div>
        </>
      )}
      <div className="fis-satir fis-kalin fis-buyuk">
        <span>TOPLAM</span>
        <span>{tl(siparis.toplam)}</span>
      </div>
      {siparis.toplam > 0 && (
        <div className="fis-satir">
          <span>Ödeme</span>
          <span>{ODEME_ADI[siparis.odeme]}</span>
        </div>
      )}
      {siparis.personelAd && (
        <div className="fis-satir">
          <span>Kasiyer</span>
          <span>{siparis.personelAd}</span>
        </div>
      )}
      <hr />
      <QrKod metin={takipAdresi(siparis.kod)} className="fis-qr" />
      <p className="fis-orta">Siparişiniz hazır olunca haber almak için QR kodu telefonunuzla okutun.</p>
      <p className="fis-orta fis-kucuk">Fiyatlara KDV dahildir.</p>
      <p className="fis-orta fis-kucuk">Sipariş fişidir, mali değeri yoktur.</p>
      <p className="fis-orta fis-kucuk fis-marka">TETRA · neardiji.com</p>
    </div>,
    document.body,
  )
}
