/* Ses ve tam ekran düğmeleri sınaması (dokunmatik, iPad ve iPhone benzeri). Kullanım: node testler/ses-tamekran.cjs <adres> */
const { chromium } = require('playwright')
const U = process.argv[2], B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2'
const bekle = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'], args: ['--autoplay-policy=user-gesture-required'], proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const p0 = await (await b.newContext()).newPage()
  const api = async (ad, g, jwt) => (await p0.request.post(`${B}/rest/v1/rpc/${ad}`, { headers: { apikey: K, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, data: g })).json().catch(() => null)
  const JWT = (await (await p0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()).access_token
  const isl = (await api('tetra_baslangic', {}, JWT)).find(x => x.tetra)
  const y = await api('tetra_cihaz_ekle', { p_restaurant: isl.id, p_ekran: 'tv', p_ad: 'Ses denemesi' }, JWT)
  const kayit = { anahtar: y.anahtar, ekran: 'tv', ad: 'Ses denemesi', isletme: { id: isl.id, slug: isl.slug, ad: isl.ad, logo: '' } }
  const senaryolar = [
    ['Tablet: ekrana dokun', { hasTouch: true, isMobile: true }, null, 'ekran'],
    ['Tablet: ses düğmesine dokun', { hasTouch: true, isMobile: true }, null, 'dugme'],
    ['Masaüstü: ses düğmesine fareyle tıkla', {}, null, 'fare'],
    ['iPad Safari benzeri tam ekran (eski komut)', { hasTouch: true }, 'ipad', 'tam'],
    ['iPhone benzeri (tam ekran yok)', { hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }, 'yok', 'tam'],
  ]
  for (const [ad, ek, tamKip, eylem] of senaryolar) {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 }, ...ek }); await c.addInitScript(k => localStorage.setItem('tetra-cihaz', JSON.stringify(k)), kayit)
    if (tamKip === 'ipad') await c.addInitScript(() => { const o = Element.prototype.requestFullscreen; Element.prototype.webkitRequestFullscreen = function () { return o.call(this) }; Element.prototype.requestFullscreen = undefined })
    if (tamKip === 'yok') await c.addInitScript(() => { Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined })
    // gerçek tarayıcı kuralı: ses bağlamı askıda başlar; yalnızca kullanıcı etkinleştirmesi (dokunmatikte parmak kalkınca) varken açılabilir
    await c.addInitScript(() => {
      const Asil = window.AudioContext
      window.__calinan = 0
      window.AudioContext = class extends Asil { constructor(...a) { super(...a); this.suspend() } resume() { return navigator.userActivation && navigator.userActivation.isActive ? super.resume() : Promise.reject(new Error('etkinleştirme yok')) } }
      const st = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.length > 1) window.__calinan++; return st.apply(this, a) }
    })
    const p = await c.newPage(); const hata = []; p.on('pageerror', e => hata.push(e.message))
    await p.goto(U + '/tv'); await p.waitForSelector('button[aria-label="Tam ekran"]', { timeout: 20000 }); await bekle(1500)
    const ses = () => p.evaluate(() => document.querySelector('header [aria-label^="Ses"]')?.getAttribute('aria-label'))
    const once = await ses()
    if (eylem === 'ekran') { await p.touchscreen.tap(640, 500) }
    if (eylem === 'fare') await p.click('header [aria-label^="Ses"]')
    if (eylem === 'dugme') { const bx = await p.locator('header [aria-label^="Ses"]').boundingBox(); await p.touchscreen.tap(bx.x + 20, bx.y + 20) }
    if (eylem === 'tam') { const bx = await p.locator('button[aria-label="Tam ekran"]').boundingBox(); await p.touchscreen.tap(bx.x + 20, bx.y + 20) }
    await bekle(900)
    const sonuc = { ad, sesOnce: once, sesSonra: await ses(), calinanSes: await p.evaluate(() => window.__calinan), uyariBandi: await p.locator('text=Sesli uyarı için ekrana bir kez dokunun').count() > 0 }
    if (eylem === 'tam') { sonuc.tamEkran = await p.evaluate(() => !!(document.fullscreenElement || document.webkitFullscreenElement)); sonuc.mesaj = (await p.locator('header ~ p[role=status]').textContent().catch(() => '')) || '' }
    if (hata.length) sonuc.hata = hata
    console.log(JSON.stringify(sonuc))
    await c.close()
  }
  for (const x of await api('tetra_cihaz_liste', { p_restaurant: isl.id }, JWT)) if (x.ad === 'Ses denemesi') await api('tetra_cihaz_sil', { p_restaurant: isl.id, p_id: x.id }, JWT)
  await b.close()
})().catch(e => { console.log('HATA', e.message.split('\n')[0]); process.exit(1) })
