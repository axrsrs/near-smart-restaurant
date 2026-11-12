// Tetra · yönetici girişi kapısı (Supabase Edge Function)
// Tarayıcı e-posta ve şifreyi buraya gönderir: { eposta, sifre }.
// Kural: aynı e-posta için 15 dakika içinde 5 hatalı deneme → hesap 15 dakika kilitlenir (doğru şifre de kabul edilmez).
// Sayaç veritabanında tutulur (tetra_giris_kilit / tetra_giris_sonuc yalnızca service_role ile çağrılabilir);
// e-posta düz yazı olarak saklanmaz, özeti saklanır. Şifre hiçbir yere yazılmaz, günlüğe düşmez.
// Yanıt her zaman 200'dür; sonuç gövdededir: { tamam, neden?, kalan?, kilit?, oturum? }.
import { createClient } from 'npm:@supabase/supabase-js@2'

const IZINLI = ['https://tetra.neardiji.com']
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const basliklar = (kaynak: string | null) => ({
  'Access-Control-Allow-Origin': kaynak && IZINLI.includes(kaynak) ? kaynak : IZINLI[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
})
const yanit = (govde: unknown, durum: number, kaynak: string | null) =>
  new Response(JSON.stringify(govde), { status: durum, headers: { ...basliklar(kaynak), 'Content-Type': 'application/json' } })

Deno.serve(async (istek) => {
  const kaynak = istek.headers.get('origin')
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204, headers: basliklar(kaynak) })
  if (istek.method !== 'POST') return yanit({ tamam: false, neden: 'gecersiz' }, 405, kaynak)

  let govde: { eposta?: unknown; sifre?: unknown }
  try {
    govde = await istek.json()
  } catch {
    return yanit({ tamam: false, neden: 'gecersiz' }, 400, kaynak)
  }
  const eposta = typeof govde.eposta === 'string' ? govde.eposta.trim().toLowerCase() : ''
  const sifre = typeof govde.sifre === 'string' ? govde.sifre : ''
  if (!EPOSTA.test(eposta) || eposta.length > 254 || sifre.length < 8 || sifre.length > 128) return yanit({ tamam: false, neden: 'gecersiz' }, 400, kaynak)

  const adres = Deno.env.get('SUPABASE_URL')!
  const db = createClient(adres, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  const kilit = await db.rpc('tetra_giris_kilit', { p_eposta: eposta })
  if (kilit.error) return yanit({ tamam: false, neden: 'sunucu' }, 200, kaynak)
  if ((kilit.data as number) > 0) return yanit({ tamam: false, neden: 'kilit', kilit: kilit.data }, 200, kaynak)

  const kimlik = createClient(adres, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const giris = await kimlik.auth.signInWithPassword({ email: eposta, password: sifre })

  if (giris.error || !giris.data.session) {
    const durum = giris.error?.status ?? 0
    // Yalnızca "bilgiler hatalı" yanıtı sayaca yazılır; sunucu arızası ya da hız sınırı kullanıcının hakkından düşmez.
    if (durum !== 400) return yanit({ tamam: false, neden: durum === 429 ? 'yogun' : 'sunucu' }, 200, kaynak)
    const s = await db.rpc('tetra_giris_sonuc', { p_eposta: eposta, p_basarili: false })
    if (s.error) return yanit({ tamam: false, neden: 'hatali' }, 200, kaynak)
    const sonuc = s.data as { kalan: number; kilit?: number }
    if (sonuc.kilit) return yanit({ tamam: false, neden: 'kilit', kilit: sonuc.kilit }, 200, kaynak)
    return yanit({ tamam: false, neden: 'hatali', kalan: sonuc.kalan }, 200, kaynak)
  }

  await db.rpc('tetra_giris_sonuc', { p_eposta: eposta, p_basarili: true })
  const o = giris.data.session
  return yanit({ tamam: true, oturum: { access_token: o.access_token, refresh_token: o.refresh_token } }, 200, kaynak)
})
