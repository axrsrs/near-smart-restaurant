/* Kasa ürün görünümü sınaması (büyük / küçük / liste). Veriyi değiştirmez: cihaz durumu, siparişler ve kayıt çağrısı taklit edilir;
   menü ve giriş gerçek sunucudan okunur. Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE.
   Kullanım: node testler/kasa-gorunum.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 200))) }
;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const [c0, p0] = [await b.newContext(), null]; const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  const kasa = async (w, h, varsayilan, tema = 'light') => {
    const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: true, kasa_gorunum: varsayilan }
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript(([x, t]) => { if (!sessionStorage.getItem('ilk')) { sessionStorage.setItem('ilk', '1'); localStorage.removeItem('tetra-kasa-gorunum') } localStorage.setItem('sr-tema', t); localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))) }, [{ anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme }, tema])
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1]
      if (ad.startsWith('tetra_cihaz_durum')) return r.fulfill({ json: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama-' + w, gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true } })
      if (ad.startsWith('tetra_siparisler')) return r.fulfill({ json: { gun: '2026-11-15', siparisler: [] } })
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message))
    await p.goto(U + '/kasa'); await p.waitForSelector('main section button', { timeout: 20000 }); await bekle(1200); return p
  }
  const sutun = p => p.$eval('main section > div', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)
  // işletme varsayılanı küçük kart
  const k = await kasa(1180, 820, 'kucuk')
  chk('İşletme varsayılanı (küçük kart) uygulanır: 4 sütun', (await sutun(k)) === 4, await sutun(k))
  await k.screenshot({ path: D + '/1-kucuk-kart.png' })
  await k.click('button[aria-label^="Ürün görünümü"]'); await k.waitForSelector('text=İşletme varsayılanı (Küçük kart)'); await k.screenshot({ path: D + '/2-gorunum-penceresi.png' })
  await k.click('button[role="radio"]:has-text("Sade liste")'); await bekle(400)
  chk('Cihazda sade listeye geçer (fotoğraf yok)', (await k.locator('main section img').count()) === 0)
  await k.screenshot({ path: D + '/3-sade-liste.png' })
  await k.reload(); await k.waitForSelector('main section button'); await bekle(800)
  chk('Cihaz seçimi yenileyince korunur', (await k.locator('main section img').count()) === 0)
  await k.locator('main section button:not([disabled])').first().click(); await bekle(300)
  chk('Listede ürüne dokununca sepete girer (adet rozeti)', (await k.locator('main section button span.bg-gold').count()) === 1)
  await k.click('button[aria-label^="Ürün görünümü"]'); await k.click('button[role="radio"]:has-text("Büyük kart")'); await bekle(400)
  chk('Büyük karta dönülür: 3 sütun', (await sutun(k)) === 3, await sutun(k))
  await k.click('button[aria-label^="Ürün görünümü"]'); await k.click('button[role="radio"]:has-text("İşletme varsayılanı")'); await bekle(400)
  chk('"İşletme varsayılanı" seçilince yeniden küçük kart', (await sutun(k)) === 4)
  // telefon
  for (const v of ['buyuk', 'kucuk', 'liste']) {
    const m = await kasa(390, 844, v, 'dark')
    const t = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    chk(`Telefon (${v}): yatay taşma yok, ${await sutun(m)} sütun`, !t)
    await m.screenshot({ path: D + `/4-telefon-${v}.png` })
  }
  // yönetim
  const cy = await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'tr-TR' })
  await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  let kayit = null
  await cy.route(`${B}/rest/v1/rpc/tetra_mali_ayar_oku`, r => r.fulfill({ json: { kdv_varsayilan: 10, mali_takip: true, kasa_gorunum: 'buyuk', urunler: {} } }))
  await cy.route(`${B}/rest/v1/rpc/tetra_kasa_gorunum_kaydet`, r => { kayit = r.request().postDataJSON(); r.fulfill({ json: { tamam: true } }) })
  const y = await cy.newPage(); await y.goto(U + '/yonetim/isletme'); await y.waitForSelector('#kasa-ayar-baslik', { timeout: 20000 }); await bekle(600)
  await y.click('section:has(#kasa-ayar-baslik) button[role="radio"]:has-text("Sade liste")'); await bekle(500)
  chk('Yönetimden varsayılan kaydedilir', kayit?.p_gorunum === 'liste', kayit)
  chk('Kaydedildi mesajı', await y.isVisible('text=Kasalar birkaç saniye içinde'))
  await y.locator('section:has(#kasa-ayar-baslik)').screenshot({ path: D + '/5-yonetim-kasa-ekrani.png' })
  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
