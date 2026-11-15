/* Dünden kalan sipariş sınaması: kasada ve mutfakta "Dünden" etiketi, kasa özetine girmemesi. Veriyi değiştirmez (siparişler taklit edilir).
   Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/eski-siparis.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 200))) }
const bugun = '2026-11-15', dun = '2026-11-14'
const sip = (no, gun, saatOnce, durum, toplam) => ({ id: `00000000-0000-4000-8000-0000000000${no}`, no, gun, zaman: new Date(Date.now() - saatOnce * 3600e3).toISOString(), tur: 'burada', durum, odeme: 'nakit', toplam, takip_kod: 'a'.repeat(32), personel_ad: 'Elif', kalemler: [{ urun_id: 'x', ad: 'Tost', fiyat: toplam, adet: 1, not: '' }], mali: null })
const liste = [sip(48, dun, 3, 'hazirlaniyor', 50000), sip(2, bugun, 0.5, 'hazirlaniyor', 12000), sip(1, bugun, 1, 'teslim', 8000)]
;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const c0 = await b.newContext(); const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  const cihaz = async (ekran, w, h) => {
    const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: false, kasa_gorunum: 'liste', mutfak_fisi: 'kapali' }
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript((x) => { localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))) }, { anahtar: 'ab'.repeat(32), ekran, ad: ekran, isletme })
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1].split('?')[0]
      if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c1', ekran, ad: ekran }, isletme, kanal: 'sinama-es-' + ekran + w, gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true } })
      if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: ekran === 'mutfak' ? liste.filter(s => s.durum === 'hazirlaniyor') : liste } })
      if (ad === 'tetra_kasa_secenekler') return r.fulfill({ json: { gruplar: [], urunler: {} } }) // seçenek okuması da taklit edilir (sahte cihaz anahtarı sunucuda tanınmaz)
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message)); return p
  }
  const k = await cihaz('kasa', 1180, 820)
  await k.goto(U + '/kasa'); await k.waitForSelector('main section button', { timeout: 20000 }); await bekle(600)
  await k.click('button[aria-label^="Bugünkü siparişler"]'); await bekle(400)
  chk('Kasada dünkü siparişte "Dünden" etiketi', (await k.locator('li:has-text("48") >> text=Dünden').count()) === 1)
  chk('Dünkü sipariş kasa özetine girmez (2 sipariş, ₺200,00 nakit)', await k.isVisible('text=₺200,00') && (await k.locator('div:has(> p:text("Sipariş")) >> p:text-is("2")').count()) >= 1)
  const sira = await k.$$eval('li span.w-12', l => l.map(e => e.textContent))
  chk('Liste en yeniden eskiye sıralı (2, 1, 48)', sira.join(',') === '2,1,48', sira)
  await k.screenshot({ path: D + '/1-kasa-dunden.png' })
  const m = await cihaz('mutfak', 1180, 820)
  await m.goto(U + '/mutfak'); await m.waitForSelector('text=Tost', { timeout: 20000 }); await bekle(500)
  chk('Mutfakta dünkü siparişte "Dünden" etiketi', (await m.locator('li:has-text("48") >> text=Dünden').count()) === 1 && (await m.locator('text=Dünden').count()) === 1)
  await m.screenshot({ path: D + '/2-mutfak-dunden.png' })
  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
