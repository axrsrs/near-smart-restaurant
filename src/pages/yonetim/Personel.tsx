import { useState, type FormEvent } from 'react'
import Anahtar from '../../components/Anahtar'
import { ALAN, BTN_ANA, BTN_IKINCIL, ETIKET, IKON_BTN } from '../../components/bicim'
import Ikon from '../../components/Ikon'
import Onay from '../../components/Onay'
import Pencere from '../../components/Pencere'
import { useListe } from '../../lib/useListe'
import { personelKaydet, personelListesi, personelSil, type PersonelKaydi, type Yetki } from '../../lib/veri'
import { useSeciliIsletme } from '../../lib/secili'

const YETKI_ADI: Record<Yetki, string> = { kasa: 'Kasa', mutfak: 'Mutfak' }
const YETKILER: Yetki[] = ['kasa', 'mutfak']

export default function Personel() {
  const isletme = useSeciliIsletme()
  const { liste, hata, yenile } = useListe(() => personelListesi(isletme.id), isletme.id)
  const [form, setForm] = useState<{ kisi?: PersonelKaydi } | null>(null)
  const [silinecek, setSilinecek] = useState<PersonelKaydi | null>(null)
  const [islemHata, setIslemHata] = useState('')

  const calistir = async (is: Promise<{ tamam: boolean; hata?: string }>) => {
    const s = await is
    setIslemHata(s.tamam ? '' : (s.hata ?? ''))
    yenile()
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted">Personel kasa ve mutfak ekranına 4 haneli PIN ile girer. Her kişinin PIN'i farklıdır.</p>
        <button type="button" onClick={() => setForm({})} className={BTN_ANA}>
          <Ikon ad="arti" className="size-4" />
          Personel ekle
        </button>
      </div>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-danger">{hata || islemHata}</p>

      {liste === null ? (
        !hata && <p className="mt-6 text-center text-sm text-muted">Personel yükleniyor…</p>
      ) : !liste.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-ink-2 p-6 text-center sm:p-10">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-soft text-gold">
            <Ikon ad="kisiler" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Henüz personel yok</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Kasa ve mutfak ekranları, en az bir personel eklenip PIN verilene kadar açılmaz.</p>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {liste.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-line bg-ink-2 p-3 pl-4">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-base font-semibold ${p.aktif ? '' : 'text-muted'}`}>{p.ad}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                  {p.yetkiler.map((y) => (
                    <span key={y} className="rounded-full bg-soft px-2 py-0.5 text-gold">{YETKI_ADI[y]}</span>
                  ))}
                  {!p.aktif && <span className="rounded-full border border-warn/50 px-2 py-0.5 text-warn">Giriş kapalı</span>}
                </p>
              </div>
              <Anahtar
                acik={p.aktif}
                degistir={(v) => void calistir(personelKaydet(isletme.id, { id: p.id, ad: p.ad, yetkiler: p.yetkiler, pin: '', aktif: v }))}
                etiket={p.aktif ? `${p.ad}: girişi kapat` : `${p.ad}: girişi aç`}
              />
              <button type="button" onClick={() => setForm({ kisi: p })} aria-label={`${p.ad}: düzenle`} title="Düzenle" className={IKON_BTN}>
                <Ikon ad="kalem" className="size-[18px]" />
              </button>
              <button type="button" onClick={() => setSilinecek(p)} aria-label={`${p.ad}: sil`} title="Sil" className={`${IKON_BTN} text-danger`}>
                <Ikon ad="cop" className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {form && <PersonelFormu isletme={isletme.id} kisi={form.kisi} kapat={() => setForm(null)} kaydedildi={() => { setForm(null); yenile() }} />}
      {silinecek && (
        <Onay
          baslik="Personel silinsin mi?"
          metin={`"${silinecek.ad}" silinecek ve PIN'i geçersiz olacak. Geçici olarak engellemek istersen silmek yerine girişini kapatabilirsin.`}
          evet="Sil"
          onayla={() => {
            void calistir(personelSil(isletme.id, silinecek.id))
            setSilinecek(null)
          }}
          kapat={() => setSilinecek(null)}
        />
      )}
    </>
  )
}

function PersonelFormu({ isletme, kisi, kapat, kaydedildi }: { isletme: string; kisi?: PersonelKaydi; kapat: () => void; kaydedildi: () => void }) {
  const [ad, setAd] = useState(kisi?.ad ?? '')
  const [yetkiler, setYetkiler] = useState<Yetki[]>(kisi?.yetkiler ?? ['kasa'])
  const [pin, setPin] = useState('')
  const [aktif, setAktif] = useState(kisi?.aktif ?? true)
  const [hata, setHata] = useState('')
  const [bekle, setBekle] = useState(false)

  const gonder = async (e: FormEvent) => {
    e.preventDefault()
    if (bekle) return
    if (ad.trim().length < 2) return setHata('Ad 2–40 karakter olmalı.')
    if (!yetkiler.length) return setHata('En az bir ekran seçin.')
    if (!kisi && !/^\d{4}$/.test(pin)) return setHata('PIN 4 haneli bir sayı olmalı.')
    setBekle(true)
    const s = await personelKaydet(isletme, { id: kisi?.id, ad, yetkiler, pin, aktif })
    setBekle(false)
    if (s.tamam) kaydedildi()
    else setHata(s.hata)
  }

  return (
    <Pencere baslik={kisi ? 'Personeli düzenle' : 'Personel ekle'} kapat={kapat}>
      <form onSubmit={gonder} onChange={() => setHata('')} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="personel-ad" className={ETIKET}>Ad</label>
          <input id="personel-ad" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={40} autoComplete="off" placeholder="Örnek: Ayşe" className={ALAN} />
        </div>
        <fieldset>
          <legend className={ETIKET}>Girebileceği ekranlar</legend>
          <div className="grid grid-cols-2 gap-2">
            {YETKILER.map((y) => {
              const secili = yetkiler.includes(y)
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={secili}
                  onClick={() => { setHata(''); setYetkiler((l) => (secili ? l.filter((x) => x !== y) : [...l, y])) }}
                  className={`flex h-12 items-center justify-center gap-2 rounded-[10px] border text-[15px] font-semibold transition ${secili ? 'border-gold bg-soft text-gold' : 'border-line bg-ink text-muted'}`}
                >
                  <Ikon ad={y} className="size-[18px]" />
                  {YETKI_ADI[y]}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor="personel-pin" className={ETIKET}>{kisi ? 'Yeni PIN' : 'PIN'}</label>
          <input
            id="personel-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="4 hane"
            className={`${ALAN} text-center text-xl font-semibold tracking-[0.5em] tabular-nums placeholder:text-base placeholder:font-normal placeholder:tracking-normal`}
          />
          {kisi && <p className="mt-1.5 text-xs text-muted">Boş bırakırsan mevcut PIN değişmez.</p>}
        </div>
        <div className="flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-1">
          <span className="min-w-0 flex-1 text-sm">
            <b className="block font-semibold">Giriş açık</b>
            <span className="text-muted">Kapalıyken PIN kabul edilmez.</span>
          </span>
          <Anahtar acik={aktif} degistir={setAktif} etiket="Giriş açık" />
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger">{hata}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={kapat} className={BTN_IKINCIL}>Vazgeç</button>
          <button type="submit" disabled={bekle} className={BTN_ANA}>{bekle ? 'Kaydediliyor' : kisi ? 'Kaydet' : 'Personeli ekle'}</button>
        </div>
      </form>
    </Pencere>
  )
}
