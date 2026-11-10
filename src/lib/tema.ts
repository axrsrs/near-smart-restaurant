import { useSyncExternalStore } from 'react'

export type Tema = 'light' | 'dark'
const ANAHTAR = 'sr-tema'
const dinleyenler = new Set<() => void>()

export function temaOku(): Tema {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function temaUygula(t: Tema) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0a0a09' : '#ebe9e5')
  try {
    localStorage.setItem(ANAHTAR, t)
  } catch {
    /* gizli sekme: seçim yalnızca bu oturumda geçerli olur */
  }
  dinleyenler.forEach((f) => f())
}

/** Temayı değiştirir; destekleyen tarayıcıda düğmeden açılan kare geçişiyle. */
export function temaDegistir(dugme?: HTMLElement | null) {
  const yeni: Tema = temaOku() === 'light' ? 'dark' : 'light'
  const az = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || az || !dugme) {
    temaUygula(yeni)
    return
  }
  const r = dugme.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const max = Math.max(x, innerWidth - x, y, innerHeight - y) * 1.05
  const kare = (d: number) =>
    `polygon(${x - d}px ${y - d}px, ${x + d}px ${y - d}px, ${x + d}px ${y + d}px, ${x - d}px ${y + d}px)`
  document
    .startViewTransition(() => temaUygula(yeni))
    .ready.then(() => {
      document.documentElement.animate(
        { clipPath: [kare(0), kare(max)] },
        { duration: 400, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
}

function abone(f: () => void) {
  dinleyenler.add(f)
  return () => {
    dinleyenler.delete(f)
  }
}

export function useTema(): Tema {
  return useSyncExternalStore(abone, temaOku)
}
