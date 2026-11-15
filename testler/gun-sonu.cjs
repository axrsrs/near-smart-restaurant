/* Gün sonu raporu sınaması. Veriyi değiştirmez: gün özeti, kayıt ve liste çağrıları taklit edilir; menü ve giriş gerçek sunucudan okunur.
   Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/gun-sonu.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 200))) }
const simdi = new Date().toISOString(), bugun = simdi.slice(0, 10)
const ozet = { gun: bugun, siparis: 48, ciro: 1245000, nakit: 427000, kart: 818000, burada: 30, paket: 18, ilk: simdi, son: simdi,
  iptal: { adet: 2, tutar: 36500, liste: [{ no: 7, tutar: 21000, kisi: 'Elif', zaman: simdi }, { no: 31, tutar: 15500, kisi: 'Murat', zaman: simdi }] },
  personel: [{ ad: 'Elif', siparis: 30, ciro: 810000, nakit: 250000, kart: 560000 }, { ad: 'Murat', siparis: 18, ciro: 435000, nakit: 177000, kart: 258000 }],
  kdv: [{ oran: 10, tutar: 1149000, kdv: 104455 }, { oran: 20, tutar: 96000, kdv: 16000 }], mali: { bekleyen: 3, tutar: 61000 },
  urunler: [{ ad: 'Tavuk Dürüm', adet: 41, ciro: 615000 }, { ad: 'Ayran', adet: 38, ciro: 114000 }, { ad: 'Efes 50 cl', adet: 8, ciro: 96000 }] }
;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const c0 = await b.newContext(); const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: true, kasa_gorunum: 'buyuk' }
  let kayitlar = [], son = null
  const kasa = async (w, h, tema = 'light') => {
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript(([x, t]) => { localStorage.setItem('sr-tema', t); localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))); window.__baski = 0; window.print = () => { window.__baski++ } }, [{ anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme }, tema])
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1].split('?')[0], g = r.request().postDataJSON() || {}
      if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama-gs-' + w, gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true } })
      if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: [] } })
      if (ad === 'tetra_kasa_secenekler') return r.fulfill({ json: { gruplar: [], urunler: {} } }) // seçenek okuması da taklit edilir (sahte cihaz anahtarı sunucuda tanınmaz)
      if (ad === 'tetra_gun_sonu_oku') return r.fulfill({ json: { ozet, kapanislar: kayitlar } })
      if (ad === 'tetra_gun_sonu_kaydet') { son = g; const k = { id: 'g' + kayitlar.length, gun: bugun, zaman: new Date().toISOString(), personel_ad: 'Elif', beklenen_nakit: ozet.nakit, sayilan_nakit: g.p_sayilan, fark: g.p_sayilan === null ? null : g.p_sayilan - ozet.nakit, aciklama: g.p_aciklama, ozet }; kayitlar = [k, ...kayitlar]; return r.fulfill({ json: { tamam: true, kapanis: k } }) }
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message))
    await p.goto(U + '/kasa'); await p.waitForSelector('main section button', { timeout: 20000 }); await bekle(800); return p
  }
  const k = await kasa(1180, 900)
  await k.click('button[aria-label^="Bugünkü siparişler"]'); await k.click('text=Gün sonu raporu'); await k.waitForSelector('text=Kasa sayımı'); await bekle(300)
  chk('Gün özeti görünür (ciro, iptal eden, personel)', await k.isVisible('text=₺12.450,00') && await k.isVisible('text=No 7 (Elif)') && await k.isVisible('text=Murat · 18 sipariş'))
  chk('Mali fişi kesilmeyen uyarısı', await k.isVisible('text=3 siparişin'))
  await k.fill('#gs-sayim', 'abc'); chk('Geçersiz tutar uyarısı, kaydet kapalı', await k.isVisible('text=Geçerli bir tutar yaz.') && await k.isDisabled('button:has-text("Gün sonunu kaydet")'))
  await k.fill('#gs-sayim', '4.200'); await bekle(100)
  chk('Fark anında görünür: ₺70,00 eksik', await k.isVisible('text=₺70,00 eksik'))
  await k.fill('#gs-not', '70 ₺ bozuk para için alındı')
  await k.screenshot({ path: D + '/1-gun-sonu-penceresi.png' })
  await k.click('button:has-text("Gün sonunu kaydet")'); await k.waitForSelector('text=itibarıyla kaydedildi'); await bekle(400)
  chk('Sayım kuruş olarak sunucuya gider (420000)', son?.p_sayilan === 420000 && son?.p_aciklama === '70 ₺ bozuk para için alındı', son)
  chk('Kaydedince rapor yazdırılır', (await k.evaluate(() => window.__baski)) === 1)
  chk('Basılan fişte "GÜN SONU RAPORU" ve fark var', (await k.textContent('.fis-kagit')).includes('GÜN SONU RAPORU') && (await k.textContent('.fis-kagit')).includes('eksik'))
  chk('Bugünkü kayıtlarda −₺70,00 görünür', await k.isVisible('text=−₺70,00'))
  await k.screenshot({ path: D + '/2-kaydedildi.png' })
  await k.emulateMedia({ media: 'print' }); await bekle(200); await k.locator('.fis-kagit').screenshot({ path: D + '/3-gun-sonu-fisi.png' }); await k.emulateMedia({ media: 'screen' })
  await k.click('button:has-text("Ara rapor yazdır")'); await bekle(300)
  chk('Ara rapor kaydetmeden yazdırır', (await k.evaluate(() => window.__baski)) === 2 && kayitlar.length === 1 && (await k.textContent('.fis-kagit')).includes('Ara rapor'))
  await k.fill('#gs-sayim', ''); await k.click('button:has-text("Gün sonunu kaydet")'); await bekle(500)
  chk('Sayımsız gün sonu da kaydedilir', son?.p_sayilan === null && kayitlar.length === 2, son)
  const m = await kasa(390, 844, 'dark')
  await m.click('button[aria-label^="Bugünkü siparişler"]'); await m.click('text=Gün sonu raporu'); await m.waitForSelector('text=Kasa sayımı'); await bekle(400)
  chk('Telefonda yatay taşma yok', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
  await m.screenshot({ path: D + '/4-telefon.png' })
  // yönetim
  const cy = await b.newContext({ viewport: { width: 1100, height: 1000 }, locale: 'tr-TR' })
  await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  await cy.route(`${B}/rest/v1/rpc/tetra_gun_sonu_liste`, r => r.fulfill({ json: kayitlar }))
  await cy.route(`${B}/rest/v1/rpc/tetra_mali_bekleyen`, r => r.fulfill({ json: [] }))
  await cy.route(`${B}/rest/v1/rpc/tetra_rapor`, r => r.fulfill({ json: { ozet: { siparis: 48, iptal: 2, ciro: 1245000, nakit: 427000, kart: 818000, burada: 30, paket: 18 }, gunler: [{ gun: bugun, siparis: 48, iptal: 2, ciro: 1245000, nakit: 427000, kart: 818000, burada: 30, paket: 18 }], urunler: ozet.urunler, kdv: ozet.kdv, mali: { bekleyen: 0, bekleyen_tutar: 0 } } }))
  const y = await cy.newPage(); await y.goto(U + '/yonetim/raporlar'); await y.waitForSelector('text=Gün sonu kayıtları', { timeout: 20000 }); await bekle(400)
  chk('Raporlar: kayıtlar ve toplam fark', await y.isVisible('text=Toplam fark: −₺70,00') && await y.isVisible('text=Sayım yok'))
  await y.screenshot({ path: D + '/5-raporlar.png', fullPage: true })
  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
