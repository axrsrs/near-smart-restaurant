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

/** İlk dokunuşta sesi açar. */
function ac() {
  const c = baglam()
  if (c && c.state === 'suspended') void c.resume().then(duyur, () => {})
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', ac, { passive: true })
  window.addEventListener('keydown', ac, { passive: true })
}

function ton(c: Ctx, frekans: number, basla: number, sure: number, guc = 0.2) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.value = frekans
  g.gain.setValueAtTime(0.0001, basla)
  g.gain.exponentialRampToValueAtTime(guc, basla + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, basla + sure)
  o.connect(g).connect(c.destination)
  o.start(basla)
  o.stop(basla + sure + 0.02)
}

/** yeni: mutfağa yeni sipariş düştü · hazir: sipariş hazır (TV) */
export function cal(tur: 'yeni' | 'hazir') {
  const c = baglam()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  if (tur === 'yeni') {
    ton(c, 880, t, 0.16)
    ton(c, 880, t + 0.22, 0.16)
  } else {
    ton(c, 660, t, 0.35, 0.25)
    ton(c, 880, t + 0.18, 0.35, 0.25)
    ton(c, 1320, t + 0.36, 0.6, 0.25)
  }
}

const abone = (f: () => void) => {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}
/** Ses şu an çalabilir mi (kullanıcı ekrana dokundu mu). */
export const useSesAcik = () => useSyncExternalStore(abone, () => baglam()?.state === 'running')
