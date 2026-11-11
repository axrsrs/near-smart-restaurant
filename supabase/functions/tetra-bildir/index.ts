// Tetra · "siparişiniz hazır" bildirimi (Supabase Edge Function)
// Mutfak ya da kasa cihazı sipariş hazır olduğunda çağırır: { anahtar: cihaz anahtarı, siparis: sipariş kimliği }.
// İşlev, cihazı ve siparişi veritabanında doğrulatır (tetra_bildirim_al yalnızca service_role ile çağrılabilir),
// o siparişe kayıtlı telefonlara Web Push gönderir. Abonelikler bir kez kullanılır ve silinir.
// Gizli değerler ortamdan gelir: VAPID_PRIVATE, SUPABASE_SERVICE_ROLE_KEY. Kodda gizli anahtar yoktur.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const IZINLI = ['https://tetra.neardiji.com']
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? ''

const basliklar = (kaynak: string | null) => ({
  'Access-Control-Allow-Origin': kaynak && IZINLI.includes(kaynak) ? kaynak : IZINLI[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})
const yanit = (govde: unknown, durum: number, kaynak: string | null) =>
  new Response(JSON.stringify(govde), { status: durum, headers: { ...basliklar(kaynak), 'Content-Type': 'application/json' } })

Deno.serve(async (istek) => {
  const kaynak = istek.headers.get('origin')
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204, headers: basliklar(kaynak) })
  if (istek.method !== 'POST') return yanit({ hata: 'Yalnızca POST' }, 405, kaynak)
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return yanit({ hata: 'Bildirim anahtarları tanımlı değil' }, 500, kaynak)

  let govde: { anahtar?: unknown; siparis?: unknown }
  try {
    govde = await istek.json()
  } catch {
    return yanit({ hata: 'Geçersiz istek' }, 400, kaynak)
  }
  const anahtar = typeof govde.anahtar === 'string' ? govde.anahtar : ''
  const siparis = typeof govde.siparis === 'string' ? govde.siparis : ''
  if (!/^[0-9a-f]{64}$/.test(anahtar) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(siparis)) return yanit({ hata: 'Geçersiz istek' }, 400, kaynak)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data, error } = await db.rpc('tetra_bildirim_al', { p_anahtar: anahtar, p_siparis: siparis })
  if (error) return yanit({ hata: 'Cihaz ya da sipariş doğrulanamadı' }, 403, kaynak)

  const abonelikler = (data?.abonelikler ?? []) as { endpoint: string; p256dh: string; auth: string }[]
  if (!abonelikler.length) return yanit({ gonderilen: 0 }, 200, kaynak)

  webpush.setVapidDetails('https://tetra.neardiji.com', VAPID_PUBLIC, VAPID_PRIVATE)
  const ileti = JSON.stringify({ no: data.no, kod: data.kod, isletme: data.isletme })
  const sonuc = await Promise.allSettled(
    abonelikler.map((a) => webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, ileti, { TTL: 900, urgency: 'high' })),
  )
  return yanit({ gonderilen: sonuc.filter((s) => s.status === 'fulfilled').length, basarisiz: sonuc.filter((s) => s.status === 'rejected').length }, 200, kaynak)
})
