/* Uyarı sesleri (ses dosyası gerekmez; tarayıcıda üretilir). Tarayıcılar sesi ancak kullanıcı ekrana bir kez
   dokunduktan sonra çalar; dokunulana kadar sesAcik() false döner ve ekran bunu kullanıcıya bildirir. */
import { useSyncExternalStore } from 'react'

type Ctx = AudioContext
let ctx: Ctx | null = null
const dinleyenler = new Set<() => void>()
const duyur = () => dinleyenler.forEach((f) => f())

function baglam(): Ctx | null {
  if (ctx) return ctx
  const Sinif = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Sinif) return null
  try {
    ctx = new Sinif()
    ctx.onstatechange = duyur
  } catch {
    ctx = null
  }
  return ctx
}

/* iPhone/iPad: yan sessiz anahtarı açıkken de uyarı duyulsun (Safari 17+ destekler) */
function oturumAyarla() {
  try {
    const n = navigator as Navigator & { audioSession?: { type: string } }
    if (n.audioSession && n.audioSession.type !== 'playback') n.audioSession.type = 'playback'
  } catch {
    /* desteklenmiyor */
  }
}
/* Safari'de sesin tamamen açılması için kullanıcı dokunuşu sırasında bir ses başlatılması gerekir: duyulmayan kısa bir ses */
function sessizCal(c: Ctx) {
  try {
    const k = c.createBufferSource()
    k.buffer = c.createBuffer(1, 1, 22050)
    k.connect(c.destination)
    k.start(0)
  } catch {
    /* önemsiz */
  }
}

/** Kullanıcı dokunuşunda sesi açar. Tarayıcılar izni dokunmatikte parmak kalkınca (pointerup/touchend/click) verir;
    yalnızca pointerdown dinlemek tabletlerde sesin hiç açılmamasına yol açıyordu. */
function ac(): Promise<boolean> {
  const c = baglam()
  if (!c) return Promise.resolve(false)
  oturumAyarla()
  if (c.state === 'running') return Promise.resolve(true)
  sessizCal(c)
  return c.resume().then(
    () => {
      duyur()
      return c.state === 'running'
    },
    () => false,
  )
}
if (typeof window !== 'undefined') {
  for (const olay of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
    window.addEventListener(olay, () => void ac(), { passive: true, capture: true })
}

/** Ses düğmesi: sesi açar (gerekirse) ve deneme için uyarıyı bir kez çalar. Dönüş: ses çalabiliyor mu. */
export async function sesiDene(tur: Ses): Promise<boolean> {
  const acik = await ac()
  if (acik) cal(tur)
  return acik
}

export type Ses = 'yeni' | 'hazirTv' | 'hazirMusteri'
const DOSYA: Record<Ses, string> = {
  yeni: '/sesler/yeni-siparis.mp3', // mutfak: kapı zili
  hazirTv: '/sesler/hazir-tv.mp3', // TV: anons
  hazirMusteri: '/sesler/hazir-musteri.mp3', // müşteri telefonu: melodi
}
const TITRESIM: Record<Ses, number[]> = {
  yeni: [250, 120, 250],
  hazirTv: [],
  hazirMusteri: [500, 150, 500, 150, 500, 150, 900],
}
const tamponlar = new Map<Ses, AudioBuffer>()
const yuklenen = new Set<Ses>()

/** Ses dosyasını önceden indirir ki çalma anında gecikme olmasın. Ekran açılırken çağrılır. */
export function sesHazirla(tur: Ses) {
  if (yuklenen.has(tur)) return
  const c = baglam()
  if (!c) return
  yuklenen.add(tur)
  fetch(DOSYA[tur])
    .then((y) => (y.ok ? y.arrayBuffer() : Promise.reject(new Error('ses'))))
    .then((veri) => c.decodeAudioData(veri))
    .then((tampon) => void tamponlar.set(tur, tampon))
    .catch(() => void yuklenen.delete(tur)) // indirilemezse yedek ton çalar; sonraki denemede yeniden indirilir
}

/* ses dosyası yüklenemediyse çalan yedek uyarı */
function yedekTon(c: Ctx) {
  const t = c.currentTime
  for (const [i, f] of [660, 880, 1320, 880, 1320].entries()) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + i * 0.25)
    g.gain.exponentialRampToValueAtTime(0.6, t + i * 0.25 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.5)
    o.connect(g).connect(c.destination)
    o.start(t + i * 0.25)
    o.stop(t + i * 0.25 + 0.55)
  }
}

/** Uyarıyı çalar ve (destekleyen cihazda) titretir. iPhone web sayfalarına titreşim izni vermez. */
export function cal(tur: Ses) {
  try {
    if (TITRESIM[tur].length) navigator.vibrate?.(TITRESIM[tur])
  } catch {
    /* titreşim desteklenmiyor */
  }
  const c = baglam()
  if (!c || c.state !== 'running') return
  const tampon = tamponlar.get(tur)
  if (!tampon) {
    sesHazirla(tur)
    return yedekTon(c)
  }
  const kaynak = c.createBufferSource()
  kaynak.buffer = tampon
  kaynak.connect(c.destination)
  kaynak.start()
}

const abone = (f: () => void) => {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
/** Ses şu an çalabilir mi (kullanıcı ekrana dokundu mu). */
export const useSesAcik = () => useSyncExternalStore(abone, () => baglam()?.state === 'running')
