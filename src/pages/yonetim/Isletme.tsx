import { useState, type FormEvent } from 'react'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import { menuYukle, useMenu } from '../../lib/menu'
import { slugKaydet, useSlug } from '../../lib/veri'

/** NearMenu bağlantısı: ürünler, fiyatlar, fotoğraflar, işletme adı ve logosu NearMenu'deki kayıttan okunur. */
export default function Isletme() {
  const slug = useSlug()
  const { menu, yukleniyor, hata } = useMenu(slug)
  const [yazilan, setYazilan] = useState(slug)
  const [formHata, setFormHata] = useState('')
  const urunSayisi = menu?.kategoriler.reduce((t, k) => t + k.urunler.length, 0) ?? 0

  const gonder = (e: FormEvent) => {
    e.preventDefault()
    const s = slugKaydet(yazilan)
    setFormHata(s.tamam ? '' : s.hata)
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <section className="rounded-2xl border border-line bg-ink-2 p-5">
        <h2 className="text-lg font-semibold">Bağlı işletme</h2>
        <p className="mt-1 text-sm text-muted">Ürünler, fiyatlar ve fotoğraflar NearMenu'den okunur. Bir ürünü NearMenu'de değiştirdiğinde kasada da değişir.</p>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-ink p-4">
          <div className="grid h-16 w-28 flex-none place-items-center">
            {menu?.isletme.logo ? <img src={menu.isletme.logo} alt="" className="max-h-full max-w-full object-contain" /> : <Ikon ad="dukkan" className="size-7 text-text/30" />}
          </div>
          <div className="min-w-0 flex-1">
            {menu ? (
              <>
                <p className="truncate text-base font-semibold">{menu.isletme.ad}</p>
                <p className="text-sm text-muted tabular-nums">{menu.kategoriler.length} kategori · {urunSayisi} ürün</p>
                <p className="text-xs text-muted">Son güncelleme: {new Date(menu.alindi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{yukleniyor ? 'Menü yükleniyor…' : 'Menü yüklenemedi.'}</p>
            )}
          </div>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-warn">{hata}</p>

        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <button type="button" disabled={yukleniyor} onClick={() => menuYukle(slug, true)} className={BTN_IKINCIL}>
            <Ikon ad="yenile" className={`size-4 ${yukleniyor ? 'animate-spin' : ''}`} />
            Menüyü şimdi yenile
          </button>
          <a href={`https://neardiji.com/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className={BTN_IKINCIL}>
            <Ikon ad="dis" className="size-4" />
            NearMenu'yü aç
          </a>
        </div>
      </section>

      <form onSubmit={gonder} noValidate className="rounded-2xl border border-line bg-ink-2 p-5">
        <label htmlFor="nearmenu-adres" className={ETIKET}>NearMenu adresi</label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-line bg-ink focus-within:border-gold focus-within:ring-3 focus-within:ring-gold/20">
            <span className="flex-none pl-3.5 text-base text-muted">neardiji.com/</span>
            <input
              id="nearmenu-adres"
              value={yazilan}
              onChange={(e) => { setYazilan(e.target.value.toLowerCase()); setFormHata('') }}
              maxLength={60}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              className={`${ALAN} border-0 bg-transparent pl-0 focus:ring-0`}
            />
          </div>
          <button type="submit" disabled={yazilan.trim() === slug} className={BTN_ANA}>Bağla</button>
        </div>
        <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{formHata}</p>
        <p className="text-xs text-muted">Önizlemede adres elle yazılır. Sunucu bağlandığında işletme, giriş yapan hesaptan kendiliğinden belirlenir.</p>
      </form>
    </div>
  )
}
