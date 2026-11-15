import { createPortal } from 'react-dom'
import { tl } from '../lib/para'
import { INDIRIM_ADI, type GunOzeti, type GunSonu } from '../lib/veri'

const saat = (z: string | number | null) => (z ? new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '–')
const farkYazi = (f: number) => (f === 0 ? 'Tam' : f > 0 ? `${tl(f)} fazla` : `${tl(-f)} eksik`)

/** Gün sonu raporu fişi (80 mm). Ekranda görünmez; yalnızca yazdırırken basılır. */
export default function GunSonuFis({ ozet, kapanis, isletmeAd, kasiyer }: { ozet: GunOzeti; kapanis?: GunSonu; isletmeAd: string; kasiyer: string }) {
  const gun = new Date(`${ozet.gun}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  const S = ({ a, b, k }: { a: string; b: string; k?: boolean }) => (
    <div className={`fis-satir ${k ? 'fis-kalin' : ''}`}>
      <span>{a}</span>
      <span>{b}</span>
    </div>
  )
  return createPortal(
    <div className="fis-kagit" aria-hidden="true">
      <p className="fis-orta fis-kalin fis-buyuk">{isletmeAd}</p>
      <p className="fis-orta fis-kalin">GÜN SONU RAPORU</p>
      <p className="fis-orta">{gun}</p>
      <p className="fis-orta fis-kucuk">İlk sipariş {saat(ozet.ilk)} · Son sipariş {saat(ozet.son)}</p>
      <p className="fis-orta fis-kucuk">{kapanis ? `Kapanış ${saat(kapanis.zaman)} · ${kapanis.personel_ad}` : `Ara rapor ${saat(Date.now())} · ${kasiyer}`}</p>
      <hr />
      <S a="Sipariş" b={String(ozet.siparis)} />
      <S a="Burada / Paket" b={`${ozet.burada} / ${ozet.paket}`} />
      <S a="Nakit" b={tl(ozet.nakit)} />
      <S a="Kart" b={tl(ozet.kart)} />
      <S a="TOPLAM CİRO" b={tl(ozet.ciro)} k />
      <hr />
      <p className="fis-kalin">KASA SAYIMI</p>
      <S a="Olması gereken nakit" b={tl(kapanis?.beklenen_nakit ?? ozet.nakit)} />
      {kapanis && kapanis.sayilan_nakit !== null && kapanis.fark !== null ? (
        <>
          <S a="Sayılan nakit" b={tl(kapanis.sayilan_nakit)} />
          <S a="Fark" b={farkYazi(kapanis.fark)} k />
        </>
      ) : (
        <p className="fis-kucuk">Sayım yapılmadı.</p>
      )}
      {kapanis?.aciklama && <p className="fis-kucuk">Not: {kapanis.aciklama}</p>}
      <hr />
      <S a={`İptal (${ozet.iptal.adet})`} b={tl(ozet.iptal.tutar)} k />
      {ozet.iptal.liste.map((x) => (
        <S key={x.no} a={`No ${x.no}${x.kisi ? ` · ${x.kisi}` : ''}`} b={tl(x.tutar)} />
      ))}
      {ozet.indirim && ozet.indirim.adet > 0 && (
        <>
          <hr />
          <S a={`İndirim ve ikram (${ozet.indirim.adet})`} b={tl(ozet.indirim.tutar)} k />
          {ozet.indirim.liste.map((x) => (
            <S key={x.no} a={`No ${x.no} · ${INDIRIM_ADI[x.tur]}${x.kisi ? ` · ${x.kisi}` : ''}`} b={tl(x.tutar)} />
          ))}
        </>
      )}
      {ozet.personel.length > 0 && (
        <>
          <hr />
          <p className="fis-kalin">PERSONEL</p>
          {ozet.personel.map((p) => (
            <S key={p.ad} a={`${p.ad} (${p.siparis})`} b={tl(p.ciro)} />
          ))}
        </>
      )}
      {ozet.kdv.length > 0 && (
        <>
          <hr />
          <p className="fis-kalin">KDV KIRILIMI</p>
          {ozet.kdv.map((k) => (
            <div key={k.oran}>
              <S a={`KDV %${k.oran}`} b={tl(k.tutar)} />
              <S a="  Matrah / KDV" b={`${tl(k.tutar - k.kdv)} / ${tl(k.kdv)}`} />
            </div>
          ))}
        </>
      )}
      {ozet.mali.bekleyen > 0 && (
        <>
          <hr />
          <S a={`Mali fişi bekleyen (${ozet.mali.bekleyen})`} b={tl(ozet.mali.tutar)} k />
        </>
      )}
      {ozet.urunler.length > 0 && (
        <>
          <hr />
          <p className="fis-kalin">EN ÇOK SATANLAR</p>
          {ozet.urunler.map((u) => (
            <S key={u.ad} a={`${u.adet} × ${u.ad}`} b={tl(u.ciro)} />
          ))}
        </>
      )}
      <hr />
      <p className="fis-orta fis-kucuk">Mali değeri yoktur. Resmî gün sonu belgesi yazarkasa Z raporudur.</p>
      <p className="fis-orta fis-kucuk fis-marka">TETRA · neardiji.com</p>
    </div>,
    document.body,
  )
}
