import { BTN_IKINCIL } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import { menuYukle, useMenu } from '../../lib/menu'
import { isletmeSec, useYonetici } from '../../lib/oturum'
import { useSeciliIsletme } from '../../lib/secili'

/** İşletme bilgisi ve NearMenu bağlantısı: ürünler, fiyatlar, fotoğraflar, ad ve logo NearMenu'deki kayıttan gelir. */
export default function Isletme() {
  const isletme = useSeciliIsletme()
  const y = useYonetici()
  const { menu, yukleniyor, hata } = useMenu(isletme.slug)
  const urunSayisi = menu?.kategoriler.reduce((t, k) => t + k.urunler.length, 0) ?? 0
  const coklu = y.durum === 'var' && y.isletmeler.filter((i) => i.tetra).length > 1

  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-ink-2 p-5">
      <h2 className="text-lg font-semibold">İşletme</h2>
      <p className="mt-1 text-sm text-muted">Ürünler, fiyatlar, fotoğraflar, işletme adı ve logosu NearMenu panelinden yönetilir. Orada yaptığın değişiklik kasada da görünür.</p>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-ink p-4">
        <div className="grid h-16 w-28 flex-none place-items-center">
          {isletme.logo ? <img src={isletme.logo} alt="" className="max-h-full max-w-full object-contain" /> : <Ikon ad="dukkan" className="size-7 text-text/30" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{isletme.ad}</p>
          <p className="truncate text-sm text-muted">neardiji.com/{isletme.slug}</p>
          <p className="text-sm text-muted tabular-nums">{menu ? `${menu.kategoriler.length} kategori · ${urunSayisi} ürün` : yukleniyor ? 'Menü yükleniyor…' : 'Menü okunamadı'}</p>
        </div>
        <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-gold">Menü + Tetra paketi</span>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-warn">
        {hata || (!isletme.abonelik ? 'Abonelik etkin görünmüyor; cihazlar çalışmayabilir.' : '')}
      </p>

      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={yukleniyor} onClick={() => void menuYukle(isletme.slug, true)} className={BTN_IKINCIL}>
          <Ikon ad="yenile" className={`size-4 ${yukleniyor ? 'animate-spin' : ''}`} />
          Menüyü şimdi yenile
        </button>
        <a href={`https://neardiji.com/${encodeURIComponent(isletme.slug)}`} target="_blank" rel="noopener noreferrer" className={BTN_IKINCIL}>
          <Ikon ad="dis" className="size-4" />
          NearMenu'yü aç
        </a>
        {coklu && (
          <button type="button" onClick={() => isletmeSec('')} className={BTN_IKINCIL}>
            Başka işletmeye geç
          </button>
        )}
      </div>
    </section>
  )
}
