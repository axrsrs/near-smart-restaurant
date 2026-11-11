/* Tarayıcı depolaması. Depolama kapalıysa (gizli sekme, kısıtlı tarayıcı) erişimin kendisi hata verir;
   o durumda okuma boş döner, yazma sessizce geçilir ve durum yalnızca bellekte kalır. */
export type Depo = 'local' | 'session'

function depo(tur: Depo): Storage | null {
  try {
    return tur === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function oku<T>(tur: Depo, anahtar: string): T | null {
  try {
    const v = depo(tur)?.getItem(anahtar)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

/** Yazılabildiyse true döner (kota dolduysa ya da depolama kapalıysa false). */
export function yaz(tur: Depo, anahtar: string, deger: unknown): boolean {
  try {
    const d = depo(tur)
    if (!d) return false
    if (deger === null) d.removeItem(anahtar)
    else d.setItem(anahtar, JSON.stringify(deger))
    return true
  } catch {
    return false
  }
}
