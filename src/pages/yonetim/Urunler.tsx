import { useMemo, useState, type FormEvent } from 'react'
import Anahtar from '../../components/Anahtar'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET, IKON_BTN } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import Onay from '../../components/Onay'
import Pencere from '../../components/Pencere'
import { fiyatCoz, fiyatYazi, tl } from '../../lib/para'
import {
  kategoriAdDegistir,
  kategoriEkle,
  kategoriSil,
  kategoriTasi,
  ornekMenuYukle,
  urunKaydet,
  urunSatista,
  urunSil,
  useKategoriler,
  useUrunler,
  type Kategori,
  type Urun,
} from '../../lib/veri'

const YENI = '__yeni__'
const kucuk = (s: string) => s.toLocaleLowerCase('tr')

export default function Urunler() {
  const kategoriler = useKategoriler()
  const urunler = useUrunler()
  const [secili, setSecili] = useState('tum')
  const [arama, setArama] = useState('')
  const [form, setForm] = useState<{ urun?: Urun } | null>(null)
  const [silinecek, setSilinecek] = useState<Urun | null>(null)
  const [katPencere, setKatPencere] = useState(false)
  const [bildirim, setBildirim] = useState('')

  const aktifSecim = secili === 'tum' || kategoriler.some((k) => k.id === secili) ? secili : 'tum'
  const gruplar = useMemo(() => {
    const a = kucuk(arama.trim())
    return kategoriler
      .filter((k) => aktifSecim === 'tum' || k.id === aktifSecim)
      .map((k) => ({
        kategori: k,
        urunler: urunler
          .filter((u) => u.kategoriId === k.id && (!a || kucuk(u.ad).includes(a)))
          .sort((x, y) => x.ad.localeCompare(y.ad, 'tr')),
      }))
      .filter((g) => g.urunler.length || (!a && aktifSecim !== 'tum'))
  }, [kategoriler, urunler, aktifSecim, arama])

  if (!kategoriler.length && !urunler.length)
    return (
      <>
        <div className="rounded-2xl border border-dashed border-line bg-ink-2 p-6 text-center sm:p-10">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
            <Ikon ad="etiket" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Menün henüz boş</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">İlk ürününü ekle ya da denemek için örnek bir büfe menüsü yükle. Örnek menüyü sonra dilediğin gibi değiştirebilirsin.</p>
          <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button type="button" onClick={() => setForm({})} className={BTN_ANA}>
              <Ikon ad="arti" className="size-4" />
              İlk ürünü ekle
            </button>
            <button
              type="button"
              onClick={() => {
                const s = ornekMenuYukle()
                if (!s.tamam) setBildirim(s.hata)
              }}
              className={BTN_IKINCIL}
            >
              Örnek menü yükle
            </button>
          </div>
          <p role="alert" className="mt-3 min-h-5 text-[13px] text-danger">{bildirim}</p>
        </div>
        {form && <UrunFormu urun={form.urun} kategoriler={kategoriler} varsayilan="" kapat={() => setForm(null)} />}
      </>
    )

  const toplam = gruplar.reduce((t, g) => t + g.urunler.length, 0)

  return (
    <>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center text-text/45 focus-within:text-text">
          <Ikon ad="ara" className="pointer-events-none absolute left-3.5 size-4" />
          <input id="urun-ara" type="search" placeholder="Ürün ara" aria-label="Ürün ara" maxLength={60} value={arama} onChange={(e) => setArama(e.target.value)} className={`${ALAN} bg-ink-2 pl-10`} />
        </label>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setKatPencere(true)} className={`${BTN_IKINCIL} flex-1 sm:flex-none`}>
            Kategoriler
          </button>
          <button type="button" onClick={() => setForm({})} className={`${BTN_ANA} flex-1 sm:flex-none`}>
            <Ikon ad="arti" className="size-4" />
            Ürün ekle
          </button>
        </div>
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4" role="group" aria-label="Kategoriye göre süz">
        <div className="flex w-max gap-2 pb-1">
          {[{ id: 'tum', ad: 'Tümü' }, ...kategoriler].map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={aktifSecim === k.id}
              onClick={() => setSecili(k.id)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${aktifSecim === k.id ? 'border-text bg-text text-ink' : 'border-line bg-ink-2 text-muted hover:text-text'}`}
            >
              {k.ad}
              <span className="ml-1.5 font-normal tabular-nums opacity-70">{k.id === 'tum' ? urunler.length : urunler.filter((u) => u.kategoriId === k.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      {!toplam && (
        <p className="mt-8 text-center text-sm text-muted">
          {arama.trim() ? `"${arama.trim()}" ile eşleşen ürün yok.` : 'Bu kategoride henüz ürün yok.'}
        </p>
      )}

      {gruplar.map(
        (g) =>
          g.urunler.length > 0 && (
            <section key={g.kategori.id} className="mt-6">
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-semibold tracking-wider text-muted uppercase">
                {g.kategori.ad}
                <span className="font-normal tabular-nums">{g.urunler.length}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {g.urunler.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 rounded-2xl border border-line bg-ink-2 p-3 pl-4">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-base font-semibold ${u.satista ? '' : 'text-muted line-through'}`}>{u.ad}</p>
                      <p className="text-sm text-muted tabular-nums">
                        {tl(u.fiyat)}
                        {!u.satista && <span className="ml-2 font-semibold text-warn">Satışa kapalı</span>}
                      </p>
                    </div>
                    <Anahtar acik={u.satista} degistir={(v) => urunSatista(u.id, v)} etiket={u.satista ? `${u.ad}: satışa kapat` : `${u.ad}: satışa aç`} />
                    <button type="button" onClick={() => setForm({ urun: u })} aria-label={`${u.ad}: düzenle`} title="Düzenle" className={IKON_BTN}>
                      <Ikon ad="kalem" className="size-[18px]" />
                    </button>
                    <button type="button" onClick={() => setSilinecek(u)} aria-label={`${u.ad}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                      <Ikon ad="cop" className="size-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}

      {form && <UrunFormu urun={form.urun} kategoriler={kategoriler} varsayilan={aktifSecim === 'tum' ? '' : aktifSecim} kapat={() => setForm(null)} />}
      {katPencere && <KategoriPenceresi kategoriler={kategoriler} urunler={urunler} kapat={() => setKatPencere(false)} />}
      {silinecek && (
        <Onay
          baslik="Ürün silinsin mi?"
          metin={`"${silinecek.ad}" menüden kalıcı olarak silinecek. Geçici olarak kaldırmak istersen silmek yerine satışa kapatabilirsin.`}
          evet="Sil"
          onayla={() => {
            urunSil(silinecek.id)
            setSilinecek(null)
          }}
          kapat={() => setSilinecek(null)}
        />
      )}
    </>
  )
}

function UrunFormu({ urun, kategoriler, varsayilan, kapat }: { urun?: Urun; kategoriler: Kategori[]; varsayilan: string; kapat: () => void }) {
  const [ad, setAd] = useState(urun?.ad ?? '')
  const [kategoriId, setKategoriId] = useState(urun?.kategoriId ?? (varsayilan || kategoriler[0]?.id || YENI))
  const [yeniKategori, setYeniKategori] = useState('')
  const [fiyat, setFiyat] = useState(urun ? fiyatYazi(urun.fiyat) : '')
  const [satista, setSatista] = useState(urun?.satista ?? true)
  const [hata, setHata] = useState('')

  const gonder = (e: FormEvent) => {
    e.preventDefault()
    const kurus = fiyatCoz(fiyat)
    if (kurus === null) return setHata('Geçerli bir fiyat yazın. Örnek: 180 ya da 45,50')
    let kId = kategoriId
    if (kId === YENI) {
      const mevcut = kategoriler.find((k) => kucuk(k.ad) === kucuk(yeniKategori.trim()))
      if (mevcut) kId = mevcut.id
      else {
        /* ürün kaydı başarısız olursa boş kategori kalmasın diye önce ürünün kendi alanları denetlenir */
        if (ad.trim().length < 2) return setHata('Ürün adı 2–60 karakter olmalı.')
        const k = kategoriEkle(yeniKategori)
        if (!k.tamam || !k.id) return setHata(k.tamam ? 'Kategori eklenemedi.' : k.hata)
        kId = k.id
        setKategoriId(kId)
      }
    }
    const s = urunKaydet({ id: urun?.id, ad, kategoriId: kId, fiyat: kurus, satista })
    if (s.tamam) kapat()
    else setHata(s.hata)
  }

  return (
    <Pencere baslik={urun ? 'Ürünü düzenle' : 'Ürün ekle'} kapat={kapat}>
      <form onSubmit={gonder} onChange={() => setHata('')} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="urun-ad" className={ETIKET}>Ürün adı</label>
          <input id="urun-ad" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} autoComplete="off" placeholder="Örnek: Tavuk Dürüm" className={ALAN} />
        </div>
        <div>
          <label htmlFor="urun-kategori" className={ETIKET}>Kategori</label>
          <select id="urun-kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)} className={ALAN}>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>{k.ad}</option>
            ))}
            <option value={YENI}>+ Yeni kategori</option>
          </select>
          {kategoriId === YENI && (
            <input id="urun-yeni-kategori" value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} maxLength={40} autoComplete="off" placeholder="Yeni kategori adı" aria-label="Yeni kategori adı" className={`${ALAN} mt-2`} />
          )}
        </div>
        <div>
          <label htmlFor="urun-fiyat" className={ETIKET}>Fiyat (₺)</label>
          <input id="urun-fiyat" value={fiyat} onChange={(e) => setFiyat(e.target.value)} inputMode="decimal" maxLength={12} autoComplete="off" placeholder="0,00" className={`${ALAN} tabular-nums`} />
        </div>
        <div className="flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-1">
          <span className="min-w-0 flex-1 text-sm">
            <b className="block font-semibold">Satışta</b>
            <span className="text-muted">Kapalıyken kasada görünmez.</span>
          </span>
          <Anahtar acik={satista} degistir={setSatista} etiket="Satışta" />
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="submit" className={BTN_ANA}>{urun ? 'Kaydet' : 'Ürünü ekle'}</button>
        </div>
      </form>
    </Pencere>
  )
}

function KategoriPenceresi({ kategoriler, urunler, kapat }: { kategoriler: Kategori[]; urunler: Urun[]; kapat: () => void }) {
  const [yeni, setYeni] = useState('')
  const [duzenlenen, setDuzenlenen] = useState<{ id: string; ad: string } | null>(null)
  const [hata, setHata] = useState('')
  const sonuc = (s: { tamam: boolean; hata?: string }) => {
    setHata(s.tamam ? '' : (s.hata ?? ''))
    return s.tamam
  }

  return (
    <Pencere baslik="Kategoriler" kapat={kapat}>
      <p className="mb-3 text-[13px] text-muted">Sıralama kasadaki sıralamadır. Okla yukarı ya da aşağı taşıyabilirsin.</p>
      <ul className="flex flex-col gap-2">
        {kategoriler.map((k, i) => {
          const adet = urunler.filter((u) => u.kategoriId === k.id).length
          const acik = duzenlenen?.id === k.id
          return (
            <li key={k.id} className="rounded-xl border border-line bg-ink p-2">
              {acik ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (sonuc(kategoriAdDegistir(k.id, duzenlenen.ad))) setDuzenlenen(null)
                  }}
                >
                  <input id={`kat-ad-${k.id}`} autoFocus value={duzenlenen.ad} onChange={(e) => setDuzenlenen({ id: k.id, ad: e.target.value })} maxLength={40} aria-label="Kategori adı" className={`${ALAN} h-11 bg-ink-2`} />
                  <button type="submit" className={`${BTN_ANA} h-11 px-3`}>Kaydet</button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1 pl-2">
                    <p className="truncate text-[15px] font-semibold">{k.ad}</p>
                    <p className="text-xs text-muted tabular-nums">{adet} ürün</p>
                  </div>
                  <button type="button" disabled={i === 0} onClick={() => sonuc(kategoriTasi(k.id, -1))} aria-label={`${k.ad}: yukarı taşı`} title="Yukarı taşı" className={IKON_BTN}>
                    <Ikon ad="yukari" className="size-[18px]" />
                  </button>
                  <button type="button" disabled={i === kategoriler.length - 1} onClick={() => sonuc(kategoriTasi(k.id, 1))} aria-label={`${k.ad}: aşağı taşı`} title="Aşağı taşı" className={IKON_BTN}>
                    <Ikon ad="asagi" className="size-[18px]" />
                  </button>
                  <button type="button" onClick={() => { setHata(''); setDuzenlenen({ id: k.id, ad: k.ad }) }} aria-label={`${k.ad}: adını değiştir`} title="Adını değiştir" className={IKON_BTN}>
                    <Ikon ad="kalem" className="size-[18px]" />
                  </button>
                  <button type="button" onClick={() => sonuc(kategoriSil(k.id))} aria-label={`${k.ad}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                    <Ikon ad="cop" className="size-[18px]" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {!kategoriler.length && <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Henüz kategori yok.</p>}
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata}</p>
      <form
        className="mt-1 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (sonuc(kategoriEkle(yeni))) setYeni('')
        }}
      >
        <input id="kat-yeni" value={yeni} onChange={(e) => setYeni(e.target.value)} maxLength={40} autoComplete="off" placeholder="Yeni kategori adı" aria-label="Yeni kategori adı" className={ALAN} />
        <button type="submit" className={`${BTN_ANA} flex-none`}>
          <Ikon ad="arti" className="size-4" />
          Ekle
        </button>
      </form>
    </Pencere>
  )
}
