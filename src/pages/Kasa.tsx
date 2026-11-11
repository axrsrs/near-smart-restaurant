import { useEffect, useMemo, useRef, useState } from 'react'
import Anahtar from '../components/Anahtar'
import { ALAN, BTN_ANA, BTN_IKINCIL, IKON_BTN } from '../components/bicim'
import Fis from '../components/Fis'
import Ikon from '../components/Ikon'
import Pencere from '../components/Pencere'
import QrKod from '../components/QrKod'
import TemaDugmesi from '../components/TemaDugmesi'
import { oku, yaz } from '../lib/depo'
import { ODEME_ADI, takipAdresi, TUR_ADI } from '../lib/etiketler'
import { menuYukle, useMenu, type MenuUrun } from '../lib/menu'
import { kilitle, type Isletme } from '../lib/oturum'
import { tl } from '../lib/para'
import {
  otomatikFisAyarla,
  siparisDurumu,
  siparisleriYukle,
  siparisOlustur,
  tukendiAyarla,
  useOtomatikFis,
  useSiparisler,
  type Odeme,
  type Siparis,
  type SiparisTuru,
} from '../lib/veri'

type Satir = { anahtar: string; urunId: string; ad: string; fiyat: number; adet: number; not: string }
type Acik = null | { t: 'sepet' } | { t: 'not'; anahtar: string } | { t: 'odeme'; istek: string } | { t: 'tamam'; siparis: Siparis } | { t: 'siparisler' }

const HAZIR_NOTLAR = ['Soğansız', 'Acısız', 'Az pişmiş', 'İyi pişmiş', 'Sossuz', 'Buzsuz', 'Şekersiz', 'Yanında peçete']
const A_SEPET = 'tetra-sepet'
const LISTE_ARALIGI = 60_000
const istekKimligi = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)))
const kucuk = (s: string) => s.toLocaleLowerCase('tr')
const anahtar = (urunId: string, not: string) => `${urunId}|${kucuk(not)}`
const saat = (z: number) => new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export default function Kasa({ isletme, personel }: { isletme: Isletme; personel: { id: string; ad: string } }) {
  const { slug, ad: isletmeAd, logo } = isletme
  const { menu, yukleniyor, hata: menuHata } = useMenu(slug)
  const siparisler = useSiparisler()
  const otomatikFis = useOtomatikFis()

  const [kategori, setKategori] = useState('tum')
  const [arama, setArama] = useState('')
  const [sepet, setSepet] = useState<Satir[]>(() => oku<Satir[]>('session', A_SEPET) ?? [])
  const [tur, setTur] = useState<SiparisTuru>('burada')
  const [stokModu, setStokModu] = useState(false)
  const [acik, setAcik] = useState<Acik>(null)
  const [basilacak, setBasilacak] = useState<{ siparis: Siparis; sira: number } | null>(null)
  const [uyari, setUyari] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const tamamlaniyor = useRef(false)

  /* bugünün siparişleri: açılışta, ekrana dönüldüğünde ve dakikada bir sunucudan okunur */
  useEffect(() => {
    const oku_ = () => {
      if (!document.hidden) void siparisleriYukle()
    }
    oku_()
    const sayac = setInterval(oku_, LISTE_ARALIGI)
    document.addEventListener('visibilitychange', oku_)
    return () => {
      clearInterval(sayac)
      document.removeEventListener('visibilitychange', oku_)
    }
  }, [])

  useEffect(() => {
    yaz('session', A_SEPET, sepet.length ? sepet : null)
  }, [sepet])

  /* fiş: önce yazdırılacak fiş sayfaya konur, sonra tarayıcının yazdırma penceresi açılır */
  useEffect(() => {
    if (!basilacak) return
    const sayac = setTimeout(() => window.print(), 80)
    return () => clearTimeout(sayac)
  }, [basilacak])
  const yazdir = (siparis: Siparis) => setBasilacak((o) => ({ siparis, sira: (o?.sira ?? 0) + 1 }))

  /* Sepet her zaman güncel menüye göre okunur: fiyat ve ad menüden gelir (sepette saklanan fiyata güvenilmez),
     tükenen ya da menüden kalkan ürün satırı düşer. */
  const { satirlar, dusenler } = useMemo(() => {
    if (!menu) return { satirlar: [] as Satir[], dusenler: [] as string[] }
    const harita = new Map<string, MenuUrun>()
    for (const k of menu.kategoriler) for (const u of k.urunler) harita.set(u.id, u)
    const s: Satir[] = []
    const d: string[] = []
    for (const x of sepet) {
      const u = harita.get(x.urunId)
      if (!u || u.tukendi) d.push(x.ad)
      else s.push({ ...x, ad: u.ad, fiyat: u.fiyat })
    }
    return { satirlar: s, dusenler: d }
  }, [sepet, menu])
  const adetler = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of satirlar) m.set(s.urunId, (m.get(s.urunId) ?? 0) + s.adet)
    return m
  }, [satirlar])
  const gruplar = useMemo(() => {
    const a = kucuk(arama.trim())
    return (menu?.kategoriler ?? [])
      .filter((k) => kategori === 'tum' || k.id === kategori)
      .map((k) => ({ ...k, urunler: a ? k.urunler.filter((u) => kucuk(u.ad).includes(a)) : k.urunler }))
      .filter((k) => k.urunler.length)
  }, [menu, kategori, arama])
  const bugunku = useMemo(() => [...siparisler].sort((x, y) => y.no - x.no), [siparisler]) // sunucu yalnızca bugünün siparişlerini döner

  const toplam = satirlar.reduce((t, s) => t + s.fiyat * s.adet, 0)
  const urunAdedi = satirlar.reduce((t, s) => t + s.adet, 0)
  const aktifKategori = kategori === 'tum' || menu?.kategoriler.some((k) => k.id === kategori) ? kategori : 'tum'

  const ekle = (u: MenuUrun) => {
    setUyari('')
    setSepet((l) => {
      const a = anahtar(u.id, '')
      const var_ = l.find((s) => s.anahtar === a)
      if (var_) return var_.adet >= 99 ? l : l.map((s) => (s.anahtar === a ? { ...s, adet: s.adet + 1 } : s))
      return [...l, { anahtar: a, urunId: u.id, ad: u.ad, fiyat: u.fiyat, adet: 1, not: '' }]
    })
  }
  const adetDegistir = (a: string, fark: number) =>
    setSepet((l) => l.flatMap((s) => (s.anahtar !== a ? [s] : s.adet + fark < 1 ? [] : [{ ...s, adet: Math.min(99, s.adet + fark) }])))
  const notKaydet = (a: string, not: string) =>
    setSepet((l) => {
      const satir = l.find((s) => s.anahtar === a)
      if (!satir) return l
      const yeni = anahtar(satir.urunId, not)
      if (yeni === a) return l.map((s) => (s.anahtar === a ? { ...s, not } : s))
      const hedef = l.find((s) => s.anahtar === yeni)
      /* aynı ürün aynı notla zaten sepetteyse iki satır birleşir */
      if (hedef) return l.filter((s) => s.anahtar !== a).map((s) => (s.anahtar === yeni ? { ...s, adet: Math.min(99, s.adet + satir.adet) } : s))
      return l.map((s) => (s.anahtar === a ? { ...s, anahtar: yeni, not } : s))
    })
  const urunDokun = async (u: MenuUrun) => {
    if (!stokModu) return ekle(u)
    /* tükendi işareti ürünün NearMenu'deki kaydını değiştirir: QR menüde de aynı anda görünür */
    const s = await tukendiAyarla(slug, u.id, !u.tukendi)
    setUyari(s.tamam ? '' : s.hata)
  }
  const tamamla = async (odeme: Odeme, istek: string) => {
    /* art arda iki dokunuş tek istek gönderir; bağlantı koparsa aynı istek kimliğiyle yeniden denenir, sunucu tek sipariş oluşturur */
    if (tamamlaniyor.current || !satirlar.length) return
    tamamlaniyor.current = true
    setKaydediliyor(true)
    const s = await siparisOlustur({ kalemler: satirlar.map(({ urunId, adet, not }) => ({ urunId, adet, not })), tur, odeme, istek })
    tamamlaniyor.current = false
    setKaydediliyor(false)
    if (!s.tamam || !s.siparis) {
      setUyari(s.tamam ? 'Sipariş kaydedilemedi.' : s.hata)
      void menuYukle(slug, true) // tükenen ya da fiyatı değişen ürün varsa sepet güncel menüye göre düzelsin
      return
    }
    setUyari('')
    setSepet([])
    setTur('burada')
    setAcik({ t: 'tamam', siparis: s.siparis })
    if (otomatikFis) yazdir(s.siparis)
  }

  const sepetIcerik = (
    <Sepet
      satirlar={satirlar}
      dusenler={dusenler}
      dusenleriSil={() => setSepet(satirlar)}
      tur={tur}
      turSec={setTur}
      toplam={toplam}
      adetDegistir={adetDegistir}
      notAc={(a) => setAcik({ t: 'not', anahtar: a })}
      bosalt={() => setSepet([])}
      tamamla={() => { setUyari(''); setAcik({ t: 'odeme', istek: istekKimligi() }) }}
    />
  )
  const notSatiri = acik?.t === 'not' ? satirlar.find((s) => s.anahtar === acik.anahtar) : undefined

  return (
    <div className="flex h-dvh flex-col bg-ink">
      <header className="flex-none border-b border-line bg-glass pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {logo ? (
            <img src={logo} alt="" className="h-9 w-auto max-w-24 flex-none object-contain" />
          ) : (
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-text text-sm font-bold text-ink">{isletmeAd.charAt(0)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">{isletmeAd}</p>
            <p className="truncate text-xs text-muted">Kasa · {personel.ad}</p>
          </div>
          <button
            type="button"
            aria-pressed={stokModu}
            onClick={() => { setStokModu((v) => !v); setUyari('') }}
            title="Tükendi işaretle"
            aria-label="Tükendi işaretleme modu"
            className={`grid size-11 flex-none place-items-center rounded-full border transition ${stokModu ? 'border-warn bg-warn text-white' : 'border-line bg-ink-2 text-text'}`}
          >
            <Ikon ad="yasak" className="size-5" />
          </button>
          <button type="button" onClick={() => setAcik({ t: 'siparisler' })} title="Bugünkü siparişler" aria-label={`Bugünkü siparişler: ${bugunku.length}`} className="relative grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-text">
            <Ikon ad="liste" className="size-5" />
            {bugunku.length > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-on-gold tabular-nums">{bugunku.length}</span>}
          </button>
          <TemaDugmesi />
          <button
            type="button"
            onClick={() => void kilitle()}
            title="Kasayı kilitle"
            aria-label="Kasayı kilitle"
            className="grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-text"
          >
            <Ikon ad="kilit" className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto pb-28 lg:pb-6">
          <div className="sticky top-0 z-10 bg-ink px-3 pt-3 pb-2 sm:px-4">
            <label className="relative flex items-center text-text/45 focus-within:text-text">
              <Ikon ad="ara" className="pointer-events-none absolute left-3.5 size-4" />
              <input id="kasa-ara" type="search" placeholder="Ürün ara" aria-label="Ürün ara" maxLength={60} value={arama} onChange={(e) => setArama(e.target.value)} className={`${ALAN} bg-ink-2 pl-10`} />
            </label>
            <div className="-mx-3 mt-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4" role="group" aria-label="Kategoriler">
              <div className="flex w-max gap-2">
                {[{ id: 'tum', ad: 'Tümü' }, ...(menu?.kategoriler ?? [])].map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={aktifKategori === k.id}
                    onClick={() => setKategori(k.id)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${aktifKategori === k.id ? 'border-text bg-text text-ink' : 'border-line bg-ink-2 text-muted hover:text-text'}`}
                  >
                    {k.ad}
                  </button>
                ))}
              </div>
            </div>
            {stokModu && (
              <p className="mt-2 rounded-xl border border-warn/50 bg-ink-2 px-3 py-2 text-[13px] text-warn">
                <b className="font-semibold">Tükendi işaretleme açık.</b> Ürüne dokununca tükendi olur, yeniden dokununca açılır. İşaret QR menüde de aynı anda görünür.
              </p>
            )}
            {(uyari || menuHata) && <p role="alert" className="mt-2 text-[13px] text-danger">{uyari || menuHata}</p>}
          </div>

          <div className="px-3 sm:px-4">
            {!menu && (
              <div className="mt-10 text-center text-sm text-muted">
                {yukleniyor ? (
                  <p>Menü yükleniyor…</p>
                ) : (
                  <button type="button" onClick={() => menuYukle(slug, true)} className={BTN_IKINCIL}>
                    <Ikon ad="yenile" className="size-4" />
                    Yeniden dene
                  </button>
                )}
              </div>
            )}
            {menu && !gruplar.length && <p className="mt-10 text-center text-sm text-muted">{arama.trim() ? `"${arama.trim()}" ile eşleşen ürün yok.` : 'Bu menüde henüz ürün yok.'}</p>}
            {gruplar.map((g) => (
              <section key={g.id} className="mt-3 first:mt-1">
                <h2 className="mb-2 text-[13px] font-semibold tracking-wider text-muted uppercase">{g.ad}</h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {g.urunler.map((u) => {
                    const tukendi = u.tukendi
                    const adet = adetler.get(u.id) ?? 0
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={tukendi && !stokModu}
                        onClick={() => void urunDokun(u)}
                        aria-label={`${u.ad}, ${tl(u.fiyat)}${tukendi ? ', tükendi' : ''}`}
                        className={`relative aspect-[4/3] overflow-hidden rounded-2xl border bg-[#262523] text-left transition active:scale-[0.97] ${adet ? 'border-gold ring-2 ring-gold/40' : 'border-line'}`}
                      >
                        {u.gorsel && <img src={u.gorsel} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.hidden = true }} className="absolute inset-0 size-full object-cover" />}
                        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />
                        <span className="absolute inset-x-0 bottom-0 p-2.5 text-white sm:p-3">
                          <span className="line-clamp-2 text-[15px] leading-tight font-semibold">{u.ad}</span>
                          <span className="mt-0.5 block text-sm tabular-nums opacity-90">{tl(u.fiyat)}</span>
                        </span>
                        {adet > 0 && <span className="absolute top-2 right-2 grid h-7 min-w-7 place-items-center rounded-full bg-gold px-1.5 text-sm font-bold text-on-gold tabular-nums">{adet}</span>}
                        {tukendi && (
                          <span className="absolute inset-0 grid place-items-center bg-black/65 text-center text-sm font-semibold text-white">
                            Tükendi
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside className="hidden w-[380px] flex-none flex-col border-l border-line bg-ink-2 lg:flex" aria-label="Sepet">
          {sepetIcerik}
        </aside>
      </div>

      {/* telefonda sepet alttaki çubuktan açılır */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-glass px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <button type="button" disabled={!satirlar.length && !dusenler.length} onClick={() => setAcik({ t: 'sepet' })} className={`${BTN_ANA} h-14 w-full justify-between px-5`}>
          <span className="flex items-center gap-2">
            <Ikon ad="sepet" className="size-5" />
            {satirlar.length ? `Sepet · ${urunAdedi} ürün` : 'Sepet boş'}
          </span>
          <span className="tabular-nums">{tl(toplam)}</span>
        </button>
      </div>

      {acik?.t === 'sepet' && (
        <Pencere baslik="Sepet" kapat={() => setAcik(null)}>
          <div className="-mx-5 -mb-5 flex flex-col">{sepetIcerik}</div>
        </Pencere>
      )}
      {notSatiri && <NotPenceresi satir={notSatiri} kaydet={(n) => { notKaydet(notSatiri.anahtar, n); setAcik(window.matchMedia('(min-width: 1024px)').matches ? null : { t: 'sepet' }) }} kapat={() => setAcik(window.matchMedia('(min-width: 1024px)').matches ? null : { t: 'sepet' })} />}
      {acik?.t === 'odeme' && (
        <Pencere baslik="Ödeme" kapat={() => !kaydediliyor && setAcik(null)}>
          <p className="text-center text-sm text-muted">{urunAdedi} ürün · {TUR_ADI[tur]}</p>
          <p className="mt-1 mb-5 text-center text-4xl font-semibold tracking-tight tabular-nums">{tl(toplam)}</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" data-ilk disabled={kaydediliyor || !satirlar.length} onClick={() => void tamamla('nakit', acik.istek)} className={`${BTN_ANA} h-20 text-lg`}>Nakit</button>
            <button type="button" disabled={kaydediliyor || !satirlar.length} onClick={() => void tamamla('kart', acik.istek)} className={`${BTN_ANA} h-20 text-lg`}>Kart</button>
          </div>
          <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-center text-[13px] text-danger">{kaydediliyor ? '' : uyari}</p>
          <p className="text-center text-xs text-muted">{kaydediliyor ? 'Sipariş kaydediliyor…' : 'Ödeme türü yalnızca kayıt içindir; ödeme cihazına bağlanmaz.'}</p>
        </Pencere>
      )}
      {acik?.t === 'tamam' && (
        <Pencere baslik="Sipariş alındı" kapat={() => setAcik(null)}>
          <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted uppercase">Sipariş no</p>
          <p className="text-center text-8xl leading-none font-bold tracking-tight tabular-nums">{acik.siparis.no}</p>
          <p className="mt-2 text-center text-sm text-muted">{TUR_ADI[acik.siparis.tur]} · {ODEME_ADI[acik.siparis.odeme]} · {tl(acik.siparis.toplam)}</p>
          <div className="mx-auto mt-4 w-44 rounded-2xl bg-white p-2">
            <QrKod metin={takipAdresi(acik.siparis.kod)} className="block size-full" />
          </div>
          <p className="mx-auto mt-3 max-w-xs text-center text-[13px] text-muted">Müşteri bu QR'ı okutunca siparişinin durumunu kendi telefonundan izler.</p>
          <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-1">
            <span className="min-w-0 flex-1 text-sm font-semibold">Fişi otomatik yazdır</span>
            <Anahtar acik={otomatikFis} degistir={otomatikFisAyarla} etiket="Fişi otomatik yazdır" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => yazdir(acik.siparis)} className={BTN_IKINCIL}>
              <Ikon ad="yazici" className="size-4" />
              Fiş yazdır
            </button>
            <button type="button" data-ilk onClick={() => setAcik(null)} className={BTN_ANA}>Yeni sipariş</button>
          </div>
        </Pencere>
      )}
      {acik?.t === 'siparisler' && <SiparislerPenceresi liste={bugunku} yazdir={yazdir} kapat={() => setAcik(null)} />}
      {basilacak && <Fis key={basilacak.sira} siparis={basilacak.siparis} isletmeAd={isletmeAd} />}
    </div>
  )
}

function Sepet(p: {
  satirlar: Satir[]
  dusenler: string[]
  dusenleriSil: () => void
  tur: SiparisTuru
  turSec: (t: SiparisTuru) => void
  toplam: number
  adetDegistir: (anahtar: string, fark: number) => void
  notAc: (anahtar: string) => void
  bosalt: () => void
  tamamla: () => void
}) {
  return (
    <>
      <div className="hidden h-14 flex-none items-center gap-2 border-b border-line px-4 lg:flex">
        <h2 className="flex-1 text-base font-semibold">Sepet</h2>
        {p.satirlar.length > 0 && (
          <button type="button" onClick={p.bosalt} className="min-h-11 rounded-lg px-2 text-[13px] text-muted hover:text-danger">Sepeti boşalt</button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {p.dusenler.length > 0 && (
          <div role="alert" className="my-2 flex items-start gap-2 rounded-xl border border-warn/50 bg-ink px-3 py-2 text-[13px] text-warn">
            <span className="min-w-0 flex-1">Tükendiği ya da menüden kalktığı için sepetten çıkarıldı: <b className="font-semibold">{p.dusenler.join(', ')}</b></span>
            <button type="button" onClick={p.dusenleriSil} className="-my-1 min-h-11 flex-none rounded-lg px-2 font-semibold underline underline-offset-2">Tamam</button>
          </div>
        )}
        {!p.satirlar.length ? (
          <div className="grid h-full min-h-40 place-items-center text-center text-sm text-muted">
            <div>
              <Ikon ad="sepet" className="mx-auto mb-2 size-8 opacity-40" />
              Ürüne dokunarak sepete ekle
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {p.satirlar.map((s) => (
              <li key={s.anahtar} className="flex items-center gap-2 py-2.5">
                <button type="button" onClick={() => p.notAc(s.anahtar)} className="min-w-0 flex-1 rounded-lg py-1 text-left">
                  <span className="block truncate text-[15px] font-semibold">{s.ad}</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-muted">
                    <span className="tabular-nums">{tl(s.fiyat * s.adet)}</span>
                    <span aria-hidden="true">·</span>
                    {s.not ? <span className="truncate font-medium text-gold">{s.not}</span> : <span className="underline underline-offset-2">Not ekle</span>}
                  </span>
                </button>
                <button type="button" onClick={() => p.adetDegistir(s.anahtar, -1)} aria-label={`${s.ad}: azalt`} className={IKON_BTN}>
                  <Ikon ad={s.adet === 1 ? 'cop' : 'eksi'} className="size-[18px]" />
                </button>
                <span className="w-6 text-center text-base font-semibold tabular-nums" aria-label={`${s.adet} adet`}>{s.adet}</span>
                <button type="button" disabled={s.adet >= 99} onClick={() => p.adetDegistir(s.anahtar, 1)} aria-label={`${s.ad}: artır`} className={IKON_BTN}>
                  <Ikon ad="arti" className="size-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-none border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink p-1" role="group" aria-label="Sipariş türü">
          {(['burada', 'paket'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={p.tur === t} onClick={() => p.turSec(t)} className={`min-h-11 rounded-lg text-sm font-semibold transition ${p.tur === t ? 'bg-text text-ink' : 'text-muted'}`}>
              {TUR_ADI[t]}
            </button>
          ))}
        </div>
        <div className="my-3 flex items-baseline justify-between">
          <span className="text-sm text-muted">Toplam</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{tl(p.toplam)}</span>
        </div>
        <button type="button" disabled={!p.satirlar.length} onClick={p.tamamla} className={`${BTN_ANA} h-14 w-full text-base`}>
          Siparişi tamamla
        </button>
        {p.satirlar.length > 0 && (
          <button type="button" onClick={p.bosalt} className="mt-1 min-h-11 w-full rounded-lg text-[13px] text-muted hover:text-danger lg:hidden">Sepeti boşalt</button>
        )}
      </div>
    </>
  )
}

function NotPenceresi({ satir, kaydet, kapat }: { satir: Satir; kaydet: (not: string) => void; kapat: () => void }) {
  const mevcut = satir.not ? satir.not.split(', ') : []
  const [secili, setSecili] = useState<string[]>(mevcut.filter((n) => HAZIR_NOTLAR.includes(n)))
  const [yazi, setYazi] = useState(mevcut.filter((n) => !HAZIR_NOTLAR.includes(n)).join(', '))
  const sonuc = [...secili, yazi.trim().replace(/\s+/g, ' ')].filter(Boolean).join(', ')

  return (
    <Pencere baslik={`${satir.ad} · not`} kapat={kapat}>
      <div className="flex flex-wrap gap-2">
        {HAZIR_NOTLAR.map((n) => {
          const acik = secili.includes(n)
          return (
            <button key={n} type="button" aria-pressed={acik} onClick={() => setSecili((l) => (acik ? l.filter((x) => x !== n) : [...l, n]))} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${acik ? 'border-gold bg-soft text-gold' : 'border-line bg-ink text-muted'}`}>
              {n}
            </button>
          )
        })}
      </div>
      <input id="kasa-not" value={yazi} onChange={(e) => setYazi(e.target.value)} maxLength={60} autoComplete="off" placeholder="Başka bir not yaz" aria-label="Serbest not" className={`${ALAN} mt-3`} />
      <p role="alert" className="mt-2 min-h-5 text-[13px] text-danger">{sonuc.length > 80 ? 'Not en fazla 80 karakter olabilir.' : ''}</p>
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        {satir.not && <button type="button" onClick={() => kaydet('')} className={BTN_IKINCIL}>Notu kaldır</button>}
        <button type="button" disabled={sonuc.length > 80} onClick={() => kaydet(sonuc)} className={BTN_ANA}>Kaydet</button>
      </div>
    </Pencere>
  )
}

function SiparislerPenceresi({ liste, yazdir, kapat }: { liste: Siparis[]; yazdir: (s: Siparis) => void; kapat: () => void }) {
  const [iptalSor, setIptalSor] = useState<string | null>(null)
  const [hata, setHata] = useState('')
  const gecerli = liste.filter((s) => s.durum !== 'iptal')
  const tutar = (o: Odeme) => gecerli.filter((s) => s.odeme === o).reduce((t, s) => t + s.toplam, 0)

  return (
    <Pencere baslik="Bugünkü siparişler" kapat={kapat}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Sipariş', String(gecerli.length)], ['Nakit', tl(tutar('nakit'))], ['Kart', tl(tutar('kart'))]].map(([ad, deger]) => (
          <div key={ad} className="rounded-xl border border-line bg-ink px-2 py-2.5">
            <p className="text-xs text-muted">{ad}</p>
            <p className="truncate text-[15px] font-semibold tabular-nums">{deger}</p>
          </div>
        ))}
      </div>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata}</p>
      {!liste.length && <p className="mt-4 mb-2 text-center text-sm text-muted">Bugün henüz sipariş alınmadı.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {liste.map((s) => (
          <li key={s.id} className={`rounded-xl border border-line bg-ink p-3 ${s.durum === 'iptal' ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3">
              <span className="w-12 flex-none text-center text-2xl font-bold tabular-nums">{s.no}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tabular-nums">
                  {tl(s.toplam)}
                  {s.durum === 'iptal' && <span className="ml-2 rounded-full border border-danger/50 px-2 py-0.5 text-xs text-danger">İptal</span>}
                  {s.durum === 'hazir' && <span className="ml-2 rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok">Hazır</span>}
                  {s.durum === 'teslim' && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs text-muted">Teslim edildi</span>}
                </p>
                <p className="truncate text-xs text-muted">{saat(s.zaman)} · {TUR_ADI[s.tur]} · {ODEME_ADI[s.odeme]} · {s.kalemler.reduce((t, k) => t + k.adet, 0)} ürün</p>
              </div>
              <button type="button" onClick={() => yazdir(s)} aria-label={`${s.no} numaralı siparişin fişini yazdır`} title="Fiş yazdır" className={IKON_BTN}>
                <Ikon ad="yazici" className="size-[18px]" />
              </button>
              {(s.durum === 'hazirlaniyor' || s.durum === 'hazir') && (
                <button type="button" onClick={() => setIptalSor(iptalSor === s.id ? null : s.id)} aria-label={`${s.no} numaralı siparişi iptal et`} title="İptal et" className={`${IKON_BTN} text-danger`}>
                  <Ikon ad="kapat" className="size-[18px]" />
                </button>
              )}
            </div>
            <p className="mt-1.5 truncate pl-15 text-xs text-muted">{s.kalemler.map((k) => `${k.adet}× ${k.ad}`).join(', ')}</p>
            {iptalSor === s.id && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                <span className="min-w-0 flex-1 text-[13px]">{s.no} numaralı sipariş iptal edilsin mi?</span>
                <button type="button" onClick={() => setIptalSor(null)} className={`${BTN_IKINCIL} h-11`}>Vazgeç</button>
                <button type="button" onClick={async () => { setIptalSor(null); const y = await siparisDurumu(s.id, 'iptal'); setHata(y.tamam ? '' : y.hata) }} className="inline-flex h-11 items-center rounded-[10px] bg-danger px-4 text-[15px] font-semibold text-on-danger">İptal et</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Pencere>
  )
}
