/* NearMenu ile ortak sunucu (Supabase). Buradaki anahtar "publishable" türdedir: tarayıcıda bulunması
   normaldir, yalnızca herkese açık okumalara (yayındaki menü) izin verir. Gizli anahtar bu projede yer almaz. */
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://rfwgjzkewtjpdcvrhepg.supabase.co'
const ANAHTAR = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2'

export async function rpc<T>(ad: string, govde: Record<string, unknown>, sureMs = 15000): Promise<T> {
  const iptal = new AbortController()
  const sayac = setTimeout(() => iptal.abort(), sureMs)
  try {
    const y = await fetch(`${URL_}/rest/v1/rpc/${encodeURIComponent(ad)}`, {
      method: 'POST',
      headers: { apikey: ANAHTAR, 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
      signal: iptal.signal,
    })
    if (!y.ok) throw new Error(`sunucu ${y.status}`)
    return (await y.json()) as T
  } finally {
    clearTimeout(sayac)
  }
}
