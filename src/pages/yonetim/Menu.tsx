import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Anahtar from '../../components/Anahtar'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET, IKON_BTN } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import Onay from '../../components/Onay'
import Pencere from '../../components/Pencere'
import { useMenu, type MenuKategori, type MenuUrun } from '../../lib/menu'
import { kategoriAdDegistir, kategoriEkle, urunEkle, urunGuncelle, urunSil, urunTukendi } from '../../lib/menuDuzenle'
import { fiyatCoz, fiyatYazi, tl } from '../../lib/para'
import { secenekListe, type SecenekVeri } from '../../lib/secenek'
import { useSeciliIsletme } from '../../lib/secili'
import { hataMetni } from '../../lib/sunucu'
import SecenekGruplari from './SecenekGruplari'
import { KDV_ORANLARI, kdvKaydet, maliAyarOku, type KdvOrani, type MaliAyar } from '../../lib/veri'

const YENI = '__yeni__'
const kucuk = (s: string) => s.toLocaleLowerCase('tr')
type Secili = { urun: MenuUrun; kategoriId: string }

/** Hızlı menü düzenleme: ad, fiyat, tükendi, ürün ve kategori ekleme. Değişiklik QR menüde ve kasada birlikte görünür. */
export default function Menu() {
  const isletme = useSeciliIsletme()
  const { menu, yukleniyor, hata } = useMenu(isletme.slug)
  const [kategori, setKategori] = useState('tum')
  const [arama, setArama] = useState('')
  const [form, setForm] = useState<{ secili?: Secili } | null>(null)
  const [silinecek, setSilinecek] = useState<MenuUrun | null>(null)
  const [katForm, setKatForm] = useState<MenuKategori | null>(null)
  const [islemHata, setIslemHata] = useState('')
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [kdv, setKdv] = useState<MaliAyar | null>(null) // ürün KDV oranları (Tetra'da tutulur, NearMenu'ye yazılmaz)

  useEffect(() => {
    let iptal = false
    maliAyarOku(isletme.id).then((a) => !iptal && setKdv(a), () => {})
    return () => {
      iptal = true
    }
  }, [isletme.id])

  // ürün seçenekleri (boy, ekstralar): Tetra'da tutulur
  const [bolum, setBolum] = useState<'urun' | 'secenek'>('urun')
  const [secVeri, setSecVeri] = useState<SecenekVeri | null>(null)
  const [secHata, setSecHata] = useState('')
  const [secSira, setSecSira] = useState(0)
  useEffect(() => {
    let iptal = false
    secenekListe(isletme.id).then(
      (v) => { if (!iptal) { setSecVeri(v); setSecHata('') } },
      (e) => !iptal && setSecHata(hataMetni(e)),
    )
    return () => {
      iptal = true
    }
  }, [isletme.id, secSira])
  const grupAdlari = (urunId: string) => {
    const ids = secVeri?.urunler[urunId] ?? []
    return ids.map((id) => secVeri?.gruplar.find((g) => g.id === id)?.ad).filter(Boolean).join(', ')
  }

  const kategoriler = useMemo(() => menu?.kategoriler ?? [], [menu])
  const aktif = kategori === 'tum' || kategoriler.some((k) => k.id === kategori) ? kategori : 'tum'
  const gruplar = useMemo(() => {
    const a = kucuk(arama.trim())
    return kategoriler
      .filter((k) => aktif === 'tum' || k.id === aktif)
      .map((k) => ({ ...k, urunler: a ? k.urunler.filter((u) => kucuk(u.ad).includes(a)) : k.urunler }))
      .filter((k) => k.urunler.length || (!a && aktif !== 'tum'))
  }, [kategoriler, aktif, arama])
  const urunSayisi = kategoriler.reduce((t, k) => t + k.urunler.length, 0)

  if (!menu) return <p className="mt-6 text-center text-sm text-muted">{yukleniyor ? 'Menü yükleniyor…' : hata || 'Menü okunamadı.'}</p>

  const bolumSecici = (
    <div role="tablist" aria-label="Menü bölümü" className="mb-4 grid max-w-sm grid-cols-2 gap-1 rounded-xl border border-line bg-ink-2 p-1">
      {([['urun', 'Ürünler'], ['secenek', 'Seçenek grupları']] as const).map(([k, ad]) => (
        <button key={k} type="button" role="tab" aria-selected={bolum === k} onClick={() => setBolum(k)} className={`min-h-11 rounded-lg text-sm font-semibold transition ${bolum === k ? 'bg-text text-ink' : 'text-muted hover:text-text'}`}>
          {ad}
          {k === 'secenek' && secVeri && secVeri.gruplar.length > 0 && <span className="ml-1.5 font-normal tabular-nums opacity-70">{secVeri.gruplar.length}</span>}
        </button>
      ))}
    </div>
  )
  if (bolum === 'secenek')
    return (
      <>
        {bolumSecici}
        {secVeri ? (
          <SecenekGruplari isletme={isletme.id} veri={secVeri} kategoriler={kategoriler} yenile={() => setSecSira((n) => n + 1)} />
        ) : (
          <p role="alert" className="mt-6 text-center text-sm text-muted">{secHata || 'Seçenekler yükleniyor…'}</p>
        )}
      </>
    )

  return (
    <>
      {bolumSecici}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted">Buradaki değişiklik QR menünde ve kasada aynı anda görünür. Fotoğraf, açıklama ve ayrıntılar NearMenu panelinde.</p>
        <a href={`https://neardiji.com/${encodeURIComponent(isletme.slug)}`} target="_blank" rel="noopener noreferrer" className={BTN_IKINCIL}>
          <Ikon ad="dis" className="size-4" />
          NearMenu panelini aç
        </a>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center text-text/45 focus-within:text-text">
          <Ikon ad="ara" className="pointer-events-none absolute left-3.5 size-4" />
          <input id="menu-ara" type="search" placeholder="Ürün ara" aria-label="Ürün ara" maxLength={60} value={arama} onChange={(e) => setArama(e.target.value)} className={`${ALAN} bg-ink-2 pl-10`} />
        </label>
        <button type="button" onClick={() => setForm({})} className={BTN_ANA}>
          <Ikon ad="arti" className="size-4" />
          Ürün ekle
        </button>
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4" role="group" aria-label="Kategoriye göre süz">
        <div className="flex w-max gap-2 pb-1">
          {[{ id: 'tum', ad: 'Tümü', urunler: { length: urunSayisi } }, ...kategoriler].map((k) => (
            <button key={k.id} type="button" aria-pressed={aktif === k.id} onClick={() => setKategori(k.id)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${aktif === k.id ? 'border-text bg-text text-ink' : 'border-line bg-ink-2 text-muted hover:text-text'}`}>
              {k.ad}
              <span className="ml-1.5 font-normal tabular-nums opacity-70">{k.urunler.length}</span>
            </button>
          ))}
        </div>
      </div>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{islemHata || hata}</p>

      {!gruplar.length && <p className="mt-6 text-center text-sm text-muted">{arama.trim() ? `"${arama.trim()}" ile eşleşen ürün yok.` : 'Henüz ürün yok. "Ürün ekle" ile başla.'}</p>}
      {gruplar.map((g) => (
        <section key={g.id} className="mt-4 first:mt-1">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-wider text-muted uppercase">
              {g.ad} <span className="font-normal tabular-nums">{g.urunler.length}</span>
            </h2>
            <button type="button" onClick={() => setKatForm(kategoriler.find((k) => k.id === g.id) ?? null)} aria-label={`${g.ad}: kategori adını değiştir`} title="Kategori adını değiştir" className={IKON_BTN}>
              <Ikon ad="kalem" className="size-[18px]" />
            </button>
          </div>
          {!g.urunler.length && <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Bu kategoride ürün yok.</p>}
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {g.urunler.map((u) => (
              <li key={u.id} className={`flex items-center gap-2 rounded-2xl border border-line bg-ink-2 p-3 pl-4 ${mesgul === u.id ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-base font-semibold ${u.tukendi ? 'text-muted line-through' : ''}`}>{u.ad}</p>
                  <p className="text-sm text-muted tabular-nums">
                    {tl(u.fiyat)}
                    {kdv?.urunler[u.id] && <span className="ml-2 rounded-full border border-line px-1.5 text-xs">KDV %{kdv.urunler[u.id]}</span>}
                    {grupAdlari(u.id) && <span className="ml-2 text-xs text-gold">{grupAdlari(u.id)}</span>}
                    {u.tukendi && <span className="ml-2 font-semibold text-warn">Tükendi</span>}
                  </p>
                </div>
                <Anahtar
                  acik={!u.tukendi}
                  etiket={u.tukendi ? `${u.ad}: satışa aç` : `${u.ad}: tükendi yap`}
                  degistir={async (satista) => {
                    if (mesgul) return
                    setMesgul(u.id)
                    const s = await urunTukendi(isletme.slug, isletme.id, u.id, !satista)
                    setIslemHata(s.tamam ? '' : s.hata)
                    setMesgul(null)
                  }}
                />
                <button type="button" onClick={() => setForm({ secili: { urun: u, kategoriId: g.id } })} aria-label={`${u.ad}: düzenle`} title="Düzenle" className={IKON_BTN}>
                  <Ikon ad="kalem" className="size-[18px]" />
                </button>
                <button type="button" onClick={() => setSilinecek(u)} aria-label={`${u.ad}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                  <Ikon ad="cop" className="size-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {form && (
        <UrunFormu
          slug={isletme.slug}
          isletme={isletme.id}
          secili={form.secili}
          kategoriler={kategoriler}
          varsayilan={aktif === 'tum' ? '' : aktif}
          kdv={kdv}
          kdvDegisti={(id, oran) => setKdv((a) => { if (!a) return a; const urunler = { ...a.urunler }; if (oran) urunler[id] = oran; else delete urunler[id]; return { ...a, urunler } })}
          kapat={() => setForm(null)}
        />
      )}
      {katForm && <KategoriFormu slug={isletme.slug} isletme={isletme.id} kategori={katForm} kapat={() => setKatForm(null)} />}
      {silinecek && (
        <Onay
          baslik="Ürün silinsin mi?"
          metin={`"${silinecek.ad}" QR menüden ve kasadan kalıcı olarak silinecek; fotoğrafı ve çevirileri de gider. Geçici olarak kaldırmak istersen silmek yerine tükendi yapabilirsin.`}
          evet="Sil"
          onayla={async () => {
            const hedef = silinecek
            setSilinecek(null)
            const s = await urunSil(isletme.slug, isletme.id, hedef.id)
            setIslemHata(s.tamam ? '' : s.hata)
          }}
          kapat={() => setSilinecek(null)}
        />
      )}
    </>
  )
}

function UrunFormu(p: {
  slug: string
  isletme: string
  secili?: Secili
  kategoriler: MenuKategori[]
  varsayilan: string
  kdv: MaliAyar | null
  kdvDegisti: (urunId: string, oran: KdvOrani | null) => void
  kapat: () => void
}) {
  const { slug, isletme, secili, kategoriler, varsayilan, kapat } = p
  const ilkOran = secili ? (p.kdv?.urunler[secili.urun.id] ?? null) : null
  const [oran, setOran] = useState<KdvOrani | null>(ilkOran)
  const [ad, setAd] = useState(secili?.urun.ad ?? '')
  const [kategoriId, setKategoriId] = useState(secili?.kategoriId ?? (varsayilan || kategoriler[0]?.id || YENI))
  const [yeniKategori, setYeniKategori] = useState('')
  const [fiyat, setFiyat] = useState(secili ? fiyatYazi(secili.urun.fiyat) : '')
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)

  const gonder = async (e: FormEvent) => {
    e.preventDefault()
    if (bekle) return
    const kurus = fiyatCoz(fiyat)
    if (ad.trim().length < 2) return setHata('Ürün adı 2–60 karakter olmalı.')
    if (kurus === null) return setHata('Geçerli bir fiyat yaz. Örnek: 180 ya da 45,50')
    setBekle(true)
    let kId = kategoriId
    if (kId === YENI) {
      const mevcut = kategoriler.find((k) => kucuk(k.ad) === kucuk(yeniKategori.trim()))
      if (mevcut) kId = mevcut.id
      else {
        const k = await kategoriEkle(slug, isletme, yeniKategori, kategoriler.length)
        if (!k.tamam || !k.id) {
          setBekle(false)
          return setHata(k.tamam ? 'Kategori eklenemedi.' : k.hata)
        }
        kId = k.id
        setKategoriId(kId)
      }
    }
    const s = secili
      ? await urunGuncelle(slug, isletme, secili.urun.id, { ad: secili.urun.ad, fiyat: secili.urun.fiyat, kategoriId: secili.kategoriId }, { ad, fiyat: kurus, kategoriId: kId })
      : await urunEkle(slug, isletme, { ad, kategoriId: kId, fiyat: kurus, sira: kategoriler.find((k) => k.id === kId)?.urunler.length ?? 0 })
    if (!s.tamam) {
      setBekle(false)
      return setHata(s.hata)
    }
    // KDV oranı Tetra'da ayrı tutulur; yalnızca değiştiyse yazılır
    const urunId = secili ? secili.urun.id : (s as { id?: string }).id
    if (urunId && oran !== ilkOran) {
      const k = await kdvKaydet(isletme, urunId, oran)
      if (!k.tamam) {
        setBekle(false)
        return setHata(`Ürün kaydedildi ama KDV oranı kaydedilemedi: ${k.hata}`)
      }
      p.kdvDegisti(urunId, oran)
    }
    setBekle(false)
    kapat()
  }

  return (
    <Pencere baslik={secili ? 'Ürünü düzenle' : 'Ürün ekle'} kapat={kapat}>
      <form onSubmit={gonder} onChange={() => setHata('')} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="urun-ad" className={ETIKET}>Ürün adı</label>
          <input id="urun-ad" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={60} autoComplete="off" placeholder="Örnek: Tavuk Dürüm" className={ALAN} />
          <p className="mt-1.5 text-xs text-muted">Adı değiştirirsen İngilizce ve Arapça çevirisi kendiliğinden yenilenir.</p>
        </div>
        <div>
          <label htmlFor="urun-kategori" className={ETIKET}>Kategori</label>
          <select id="urun-kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)} className={ALAN}>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>{k.ad}</option>
            ))}
            <option value={YENI}>+ Yeni kategori</option>
          </select>
          {kategoriId === YENI && <input id="urun-yeni-kategori" value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} maxLength={40} autoComplete="off" placeholder="Yeni kategori adı" aria-label="Yeni kategori adı" className={`${ALAN} mt-2`} />}
        </div>
        <div>
          <label htmlFor="urun-fiyat" className={ETIKET}>Fiyat (₺)</label>
          <input id="urun-fiyat" value={fiyat} onChange={(e) => setFiyat(e.target.value)} inputMode="decimal" maxLength={12} autoComplete="off" placeholder="0,00" className={`${ALAN} tabular-nums`} />
          <p className="mt-1.5 text-xs text-muted">KDV dahil satış fiyatı.</p>
        </div>
        {p.kdv && (
          <div>
            <label htmlFor="urun-kdv" className={ETIKET}>KDV oranı</label>
            <select id="urun-kdv" value={oran ?? ''} onChange={(e) => setOran(e.target.value ? (Number(e.target.value) as KdvOrani) : null)} className={ALAN}>
              <option value="">Varsayılan (%{p.kdv.kdv_varsayilan})</option>
              {KDV_ORANLARI.map((o) => (
                <option key={o} value={o}>%{o}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">Alkollü içecekler için %20 seç. Yalnızca Tetra raporunda kullanılır; QR menüde görünmez.</p>
          </div>
        )}
        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="submit" disabled={bekle} className={BTN_ANA}>{bekle ? 'Kaydediliyor' : secili ? 'Kaydet' : 'Ürünü ekle'}</button>
        </div>
      </form>
    </Pencere>
  )
}

function KategoriFormu({ slug, isletme, kategori, kapat }: { slug: string; isletme: string; kategori: MenuKategori; kapat: () => void }) {
  const [ad, setAd] = useState(kategori.ad)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)
  return (
    <Pencere baslik="Kategori adını değiştir" kapat={kapat}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (bekle) return
          if (ad.trim() === kategori.ad) return kapat()
          setBekle(true)
          const s = await kategoriAdDegistir(slug, isletme, kategori.id, ad)
          setBekle(false)
          if (s.tamam) kapat()
          else setHata(s.hata)
        }}
      >
        <div>
          <label htmlFor="kategori-ad" className={ETIKET}>Kategori adı</label>
          <input id="kategori-ad" value={ad} onChange={(e) => { setAd(e.target.value); setHata('') }} maxLength={40} autoComplete="off" className={ALAN} />
          <p className="mt-1.5 text-xs text-muted">Çevirisi kendiliğinden yenilenir. Sıralama ve silme NearMenu panelinden yapılır.</p>
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="submit" disabled={bekle} className={BTN_ANA}>{bekle ? 'Kaydediliyor' : 'Kaydet'}</button>
        </div>
      </form>
    </Pencere>
  )
}
