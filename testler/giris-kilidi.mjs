// Giriş kilidi sınaması (canlı): 5 hatalı deneme → 15 dakika kilit. Gerçek hesabı kilitlememek için rastgele bir e-posta kullanılır.
// Çalıştırma: TETRA_TEST_EPOSTA ve TETRA_TEST_SIFRE ortam değişkenleriyle  node testler/giris-kilidi.mjs
const ADRES = 'https://rfwgjzkewtjpdcvrhepg.supabase.co'
const ANAHTAR = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2'
let gecen = 0, kalan = 0
const bak = (ad, kosul, ek = '') => { kosul ? gecen++ : kalan++; console.log(`${kosul ? '✓' : '✗'} ${ad}${kosul ? '' : ' → ' + ek}`) }
const kapi = async (eposta, sifre, ek = {}) => {
  const y = await fetch(`${ADRES}/functions/v1/tetra-giris`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANAHTAR, Origin: 'https://tetra.neardiji.com' }, body: JSON.stringify({ eposta, sifre }), ...ek })
  return { durum: y.status, govde: await y.json().catch(() => null), basliklar: y.headers }
}
const sahte = `kilit-deneme-${crypto.randomUUID()}@ornek.invalid`

for (let i = 1; i <= 4; i++) {
  const y = await kapi(sahte, 'yanlis-sifre-123')
  bak(`${i}. hatalı deneme: reddedildi, kalan hak ${5 - i}`, y.govde?.tamam === false && y.govde?.neden === 'hatali' && y.govde?.kalan === 5 - i, JSON.stringify(y.govde))
}
let y = await kapi(sahte, 'yanlis-sifre-123')
bak('5. hatalı deneme: hesap 15 dakika kilitlendi', y.govde?.neden === 'kilit' && y.govde?.kilit === 900, JSON.stringify(y.govde))
y = await kapi(sahte, 'baska-bir-sifre-456')
bak('Kilitliyken yeni deneme: şifreye bakılmadan reddedildi', y.govde?.neden === 'kilit' && y.govde?.kilit > 800 && y.govde?.kilit <= 900, JSON.stringify(y.govde))
y = await kapi(sahte.toUpperCase(), 'baska-bir-sifre-456')
bak('Büyük harfle yazılan aynı e-posta da kilitli', y.govde?.neden === 'kilit', JSON.stringify(y.govde))
bak('Yanıtta oturum bilgisi yok', !y.govde?.oturum)
bak('Yanıt önbelleğe alınmıyor', y.basliklar.get('cache-control') === 'no-store')

y = await kapi('gecersiz', 'x')
bak('Biçimsiz istek 400', y.durum === 400)
y = await kapi(sahte, 'a'.repeat(200))
bak('Aşırı uzun şifre 400', y.durum === 400)
const g = await fetch(`${ADRES}/functions/v1/tetra-giris`, { method: 'GET', headers: { apikey: ANAHTAR } })
bak('GET isteği 405', g.status === 405)

for (const ad of ['tetra_giris_kilit', 'tetra_giris_sonuc']) {
  const r = await fetch(`${ADRES}/rest/v1/rpc/${ad}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}` }, body: JSON.stringify(ad.endsWith('kilit') ? { p_eposta: sahte } : { p_eposta: sahte, p_basarili: true }) })
  bak(`${ad}: dışarıdan çağrılamıyor (${r.status})`, r.status === 401 || r.status === 403 || r.status === 404, await r.text())
}
y = await kapi(sahte, 'yanlis-sifre-123')
bak('Dışarıdan sıfırlama denemesi kilidi açmadı', y.govde?.neden === 'kilit', JSON.stringify(y.govde))

const E = process.env.TETRA_TEST_EPOSTA, P = process.env.TETRA_TEST_SIFRE
if (E && P) {
  y = await kapi(E, 'kesinlikle-yanlis-1')
  bak('Gerçek hesap, yanlış şifre: reddedildi', y.govde?.neden === 'hatali' && y.govde?.kalan === 4, JSON.stringify({ ...y.govde, oturum: undefined }))
  y = await kapi(E, P)
  bak('Gerçek hesap, doğru şifre: oturum açıldı', y.govde?.tamam === true && !!y.govde?.oturum?.access_token && !!y.govde?.oturum?.refresh_token, y.govde?.neden)
  y = await kapi(E, 'kesinlikle-yanlis-1')
  bak('Başarılı giriş sayacı sıfırladı (kalan yine 4)', y.govde?.kalan === 4, JSON.stringify({ ...y.govde, oturum: undefined }))
  y = await kapi(E, P)
  bak('Sayaç temizlendi', y.govde?.tamam === true)
}
console.log(`\n${gecen} geçti, ${kalan} kaldı`)
process.exit(kalan ? 1 : 0)
