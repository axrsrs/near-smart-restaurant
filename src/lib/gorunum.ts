/* İşletmeye özel görünüm: 8 hazır palet + isteğe bağlı vurgu rengi.
   Seçim sunucuda işletme kaydında durur ({ palet, vurgu }); cihazlar ve müşteri takip sayfası açılışta alır.
   Uygulama: renk değişkenleri tek bir <style> etiketiyle :root'a yazılır (açık ve koyu tema ayrı).
   Giriş, PIN ve kurulum sayfası [data-near] ile kendi renklerini taşıdığı için etkilenmez.
   Son uygulanan görünüm cihazda saklanır; sayfa açılırken (tema-baslat.js) beklemeden uygulanır. */

export type PaletKodu = 'orman' | 'near' | 'gece' | 'bordo' | 'kahve' | 'mandalina' | 'siyah-altin' | 'lavanta'
export type Gorunum = { palet: PaletKodu; vurgu: string | null }
type Taban = { z: string; k: string; v: string; y: string; s: string; vy?: string }
type Palet = { kod: PaletKodu; ad: string; not: string; a: Taban; d: Taban; tam?: { a: Record<string, string>; d: Record<string, string> } }

export const PALETLER: Palet[] = [
  { kod: 'orman', ad: 'Orman', not: 'Varsayılan', a: { z: '#d6cebf', k: 'rgba(255,255,255,.6)', v: '#294b39', y: '#1f2622', s: '#48524a' }, d: { z: '#1f221d', k: 'rgba(34,33,30,.66)', v: '#91d5b0', y: '#f4f4ed', s: '#d0c9bf' } },
  {
    kod: 'near', ad: 'NEAR Mono', not: 'Klasik siyah-beyaz, mavi vurgu',
    a: { z: '#ebe9e5', k: '#f7f6f3', v: '#1d5fa8', y: '#151514', s: '#5d5b57' }, d: { z: '#0a0a09', k: '#161615', v: '#6aa5e8', y: '#f1efea', s: '#a3a09a' },
    tam: {
      a: { '--color-ink': '#ebe9e5', '--color-ink-3': '#e2dfda', '--color-line': '#d3d0ca', '--color-soft': '#dde6f1', '--color-glass': 'rgb(250 249 246 / .9)', '--cam-kenar': 'transparent', '--cam-golge': 'rgb(0 0 0 / .12)' },
      d: { '--color-ink': '#0a0a09', '--color-ink-3': '#222220', '--color-line': '#2e2d2b', '--color-soft': '#14233a', '--color-glass': 'rgb(12 12 11 / .86)', '--cam-kenar': 'transparent', '--cam-golge': 'rgb(0 0 0 / .5)' },
    },
  },
  { kod: 'gece', ad: 'Gece Mavisi', not: 'Sakin, kurumsal', a: { z: '#d8dde5', k: 'rgba(255,255,255,.62)', v: '#1f3a5f', y: '#18202b', s: '#4a5566' }, d: { z: '#141922', k: 'rgba(36,44,58,.72)', v: '#8fb4e8', y: '#eef2f8', s: '#b4bfcf' } },
  { kod: 'bordo', ad: 'Bordo', not: 'Steakhouse, şarap barı', a: { z: '#e2d5d2', k: 'rgba(255,255,255,.6)', v: '#6b1f2a', y: '#2a1a1c', s: '#5e4a4c' }, d: { z: '#1f1416', k: 'rgba(52,34,37,.72)', v: '#e39aa3', y: '#f6eeee', s: '#cdb9bb' } },
  { kod: 'kahve', ad: 'Kahve', not: 'Kafe, fırın, kahveci', a: { z: '#dccfc0', k: 'rgba(255,255,255,.6)', v: '#5a3a22', y: '#2a2018', s: '#5f5144' }, d: { z: '#1e1813', k: 'rgba(50,40,31,.72)', v: '#d9b08a', y: '#f6f0e8', s: '#cfc1b2' } },
  { kod: 'mandalina', ad: 'Mandalina', not: 'Burger, fast food', a: { z: '#eddfd0', k: 'rgba(255,255,255,.62)', v: '#b4521f', y: '#2b1d14', s: '#65503f' }, d: { z: '#211812', k: 'rgba(54,40,30,.72)', v: '#f0a066', y: '#f8f0e8', s: '#d5c2b1' } },
  { kod: 'siyah-altin', ad: 'Siyah Altın', not: 'Premium, lounge', a: { z: '#e6e1d5', k: 'rgba(255,255,255,.62)', v: '#151514', y: '#151514', s: '#5b564c', vy: '#e9cf8c' }, d: { z: '#0f0f0e', k: 'rgba(32,30,26,.78)', v: '#d4af5a', y: '#f3ecdc', s: '#b9ae97' } },
  { kod: 'lavanta', ad: 'Lavanta', not: 'Tatlıcı, çay evi', a: { z: '#e0dbe7', k: 'rgba(255,255,255,.62)', v: '#4b3b73', y: '#211b2c', s: '#564e66' }, d: { z: '#18151f', k: 'rgba(40,35,52,.74)', v: '#b9a6e8', y: '#f2eff8', s: '#c2bad2' } },
]
export const VARSAYILAN: Gorunum = { palet: 'orman', vurgu: null }
const A_CSS = 'tetra-gorunum-css'
const RENK = /^#[0-9a-f]{6}$/i

/* ── renk yardımcıları ── */
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const karistir = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t) }
const saydam = (h: string, a: number) => { const [r, g, b] = rgb(h); return `rgb(${r} ${g} ${b} / ${a})` }
const parlaklik = (h: string) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
export const kontrast = (a: string, b: string) => { const x = parlaklik(a), y = parlaklik(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const ustYazi = (v: string) => (kontrast(v, '#ffffff') >= kontrast(v, '#111111') ? '#ffffff' : '#111111')
/** Vurgu rengini zemine karşı okunur hâle getirir (en az 3:1). */
export function okunurVurgu(v: string, zemin: string, koyu: boolean) {
  let r = v
  for (let i = 0; i < 14 && kontrast(r, zemin) < 3; i++) r = karistir(r, koyu ? '#ffffff' : '#000000', 0.12)
  return r
}

export function gecerli(g: unknown): Gorunum | null {
  if (!g || typeof g !== 'object') return null
  const x = g as { palet?: unknown; vurgu?: unknown }
  if (!PALETLER.some((p) => p.kod === x.palet)) return null
  return { palet: x.palet as PaletKodu, vurgu: typeof x.vurgu === 'string' && RENK.test(x.vurgu) ? x.vurgu.toLowerCase() : null }
}

function degiskenler(p: Palet, kip: 'a' | 'd', vurgu: string | null): Record<string, string> {
  const t = p[kip], koyu = kip === 'd'
  const v = vurgu ? okunurVurgu(vurgu, t.z, koyu) : t.v
  const d: Record<string, string> = {
    '--cam-taban': t.z,
    '--color-ink': koyu ? saydam(karistir(t.z, '#000000', 0.2), 0.55) : 'rgb(255 255 255 / .5)',
    '--color-ink-2': t.k,
    '--color-ink-3': saydam(t.y, koyu ? 0.07 : 0.08),
    '--color-line': saydam(t.y, koyu ? 0.15 : 0.2),
    '--color-gold': v,
    '--color-gold-dark': karistir(v, koyu ? '#ffffff' : '#000000', 0.18),
    '--color-on-gold': vurgu ? ustYazi(v) : (t.vy ?? ustYazi(v)),
    '--color-soft': koyu ? saydam(v, 0.22) : karistir(v, '#ffffff', 0.82),
    '--color-text': t.y,
    '--color-muted': t.s,
    '--color-glass': koyu ? saydam(karistir(t.z, '#000000', 0.1), 0.82) : saydam(karistir(t.z, '#ffffff', 0.55), 0.78),
    '--cam-kenar': koyu ? 'rgb(255 255 255 / .12)' : 'rgb(255 255 255 / .65)',
    '--cam-golge': koyu ? 'rgb(0 0 0 / .55)' : saydam(t.y, 0.26),
  }
  if (p.tam) Object.assign(d, p.tam[kip], vurgu ? { '--color-soft': d['--color-soft'] } : {})
  return d
}

/** Görünümün CSS'i. Varsayılan (Orman, özel vurgu yok) için boş: stil dosyasındaki değerler geçerli. */
export function gorunumCss(g: Gorunum | null): string {
  if (!g || (g.palet === 'orman' && !g.vurgu)) return ''
  const p = PALETLER.find((x) => x.kod === g.palet) ?? PALETLER[0]
  const yaz = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';')
  // html:root seçicisi, stil dosyasındaki :root ve :root[data-theme] tanımlarından baskındır (sıra fark etmez)
  return `html:root{${yaz(degiskenler(p, 'a', g.vurgu))}}html:root[data-theme="dark"]{${yaz(degiskenler(p, 'd', g.vurgu))}}`
}

function stilYaz(css: string) {
  let el = document.getElementById('tetra-gorunum') as HTMLStyleElement | null
  if (!css) { el?.remove(); return }
  if (!el) { el = document.createElement('style'); el.id = 'tetra-gorunum'; document.head.appendChild(el) }
  if (el.textContent !== css) el.textContent = css
}

/** Görünümü uygular. kalici: cihazda saklanır, bir sonraki açılışta beklemeden uygulanır (önizlemede false). */
export function gorunumUygula(g: unknown, kalici = true) {
  const css = gorunumCss(gecerli(g))
  stilYaz(css)
  if (kalici) try { if (css) localStorage.setItem(A_CSS, css); else localStorage.removeItem(A_CSS) } catch { /* depolama kapalı */ }
}

/** Palet önizlemesi için üç renk: zemin, kart, vurgu (geçerli temaya göre). */
export function paletRenkleri(kod: PaletKodu, vurgu: string | null, koyu: boolean) {
  const p = PALETLER.find((x) => x.kod === kod) ?? PALETLER[0]
  const t = koyu ? p.d : p.a
  return { zemin: t.z, kart: t.k, vurgu: vurgu ? okunurVurgu(vurgu, t.z, koyu) : t.v, yazi: t.y }
}
