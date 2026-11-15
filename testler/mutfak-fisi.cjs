/* Mutfak fişi sınaması (kasada / mutfakta / kapalı). Veriyi değiştirmez: cihaz durumu, siparişler ve kayıt çağrıları taklit edilir;
   menü ve giriş gerçek sunucudan okunur. Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE.
   Kullanım: node testler/mutfak-fisi.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 200))) }
const simdi = () => new Date().toISOString(), bugun = simdi().slice(0, 10)
const sip = (no, kalemler, tur = 'burada') => ({ id: `00000000-0000-4000-8000-0000000000${String(no).padStart(2, '0')}`, no, gun: bugun, zaman: simdi(), tur, durum: 'hazirlaniyor', odeme: 'nakit', toplam: 0, takip_kod: 'a'.repeat(32), personel_ad: 'Elif', kalemler, mali: null })
const yenile = p => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
const baski = p => p.evaluate(() => window.__baski)

;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const c0 = await b.newContext(); const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)

  const cihaz = async (ekran, yer, liste, w = 1180, h = 820) => {
    const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: false, kasa_gorunum: 'liste', mutfak_fisi: yer }
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript((x) => {
      localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32)))
      window.__baski = 0; window.print = () => { window.__baski++ }
    }, { anahtar: 'ab'.repeat(32), ekran, ad: ekran, isletme })
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1].split('?')[0]
      if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c1', ekran, ad: ekran }, isletme, kanal: 'sinama-mf-' + w + ekran + yer, gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true } })
      if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: liste.v } })
      if (ad === 'tetra_kasa_secenekler') return r.fulfill({ json: { gruplar: [], urunler: {} } }) // seçenek okuması da taklit edilir (sahte cihaz anahtarı sunucuda tanınmaz)
      if (ad === 'tetra_siparis_olustur') {
        const s = sip(12, [{ urun_id: 'x', ad: 'Tavuk Dürüm', fiyat: 15000, adet: 2, not: 'Soğansız, Acısız' }, { urun_id: 'y', ad: 'Ayran', fiyat: 3000, adet: 2, not: '' }], 'paket')
        s.toplam = 36000; liste.v = [s, ...liste.v]; return r.fulfill({ json: { tamam: true, siparis: s } })
      }
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message)); return p
  }
  const siparisAl = async (p) => {
    await p.locator('main section button:not([disabled])').first().click(); await p.click('text=Siparişi tamamla'); await p.click('button:has-text("Nakit")')
    await p.waitForSelector('text=Sipariş alındı'); await bekle(400)
  }

  /* A: kasada */
  const kl = { v: [] }; const k = await cihaz('kasa', 'kasa', kl)
  await k.goto(U + '/kasa'); await k.waitForSelector('main section button', { timeout: 20000 }); await bekle(800)
  await siparisAl(k)
  const fisler = await k.$$eval('.fis-kagit', l => l.map(e => e.textContent))
  chk('Kasada: müşteri fişi + mutfak fişi tek baskıda', fisler.length === 2 && (await baski(k)) === 1, fisler.length)
  chk('Mutfak fişinde fiyat yok; not ve PAKET var', fisler[1]?.includes('MUTFAK') && !fisler[1]?.includes('₺') && fisler[1]?.includes('Soğansız') && fisler[1]?.includes('PAKET'), fisler[1])
  chk('Düğme "Fişleri yazdır" olur', await k.isVisible('button:has-text("Fişleri yazdır")'))
  await k.emulateMedia({ media: 'print' }); await bekle(200); await k.locator('.fis-mutfak').screenshot({ path: D + '/1-mutfak-fisi.png' }); await k.emulateMedia({ media: 'screen' })
  await k.click('text=Yeni sipariş'); await k.click('button[aria-label^="Bugünkü siparişler"]'); await k.click('button[aria-label^="12 numaralı siparişin fişini"]'); await bekle(300)
  chk('Listeden yeniden yazdırmada yalnızca müşteri fişi', (await k.$$('.fis-kagit')).length === 1)

  /* kapalı */
  const k2 = await cihaz('kasa', 'kapali', { v: [] }); await k2.goto(U + '/kasa'); await k2.waitForSelector('main section button', { timeout: 20000 }); await bekle(600)
  await siparisAl(k2)
  chk('Kapalıyken yalnızca müşteri fişi', (await k2.$$('.fis-kagit')).length === 1)

  /* B: mutfakta */
  const ml = { v: [sip(1, [{ urun_id: 'x', ad: 'Lahmacun', fiyat: 0, adet: 1, not: '' }])] }; const m = await cihaz('mutfak', 'mutfak', ml)
  await m.goto(U + '/mutfak'); await m.waitForSelector('text=Lahmacun', { timeout: 20000 }); await bekle(800)
  chk('Açılışta mevcut sipariş basılmaz', (await baski(m)) === 0)
  ml.v = [...ml.v, sip(2, [{ urun_id: 'x', ad: 'Tavuk Dürüm', fiyat: 0, adet: 2, not: 'Acısız' }]), sip(3, [{ urun_id: 'y', ad: 'Kola', fiyat: 0, adet: 1, not: '' }], 'paket')]
  await yenile(m); await m.waitForSelector('text=Kola'); await bekle(500)
  const mf = await m.$$eval('.fis-mutfak', l => l.map(e => e.textContent))
  chk('Yeni gelen 2 sipariş tek baskıda, sırayla', mf.length === 2 && mf[0].includes('Tavuk') && mf[1].includes('Kola') && (await baski(m)) === 1, mf)
  await m.reload(); await m.waitForSelector('text=Kola'); await bekle(500); await yenile(m); await bekle(500)
  chk('Yenileyince aynı siparişler yeniden basılmaz', (await baski(m)) === 0)
  await m.click('button[aria-label="Yeni siparişte mutfak fişini otomatik yazdır"]'); await bekle(100)
  ml.v = [...ml.v, sip(4, [{ urun_id: 'z', ad: 'Su', fiyat: 0, adet: 1, not: '' }])]
  await yenile(m); await m.waitForSelector('text=Su'); await bekle(500)
  chk('Cihazda otomatik fiş kapatılınca basılmaz', (await baski(m)) === 0)
  await m.click('button[aria-label="4 numaralı siparişin mutfak fişini yazdır"]'); await bekle(300)
  chk('Karttan elle yazdırılır', (await baski(m)) === 1)
  await m.screenshot({ path: D + '/2-mutfak-ekrani.png' })
  const mt = await cihaz('mutfak', 'mutfak', { v: ml.v }, 390, 844); await mt.goto(U + '/mutfak'); await mt.waitForSelector('text=Kola', { timeout: 20000 }); await bekle(500)
  chk('Telefonda yatay taşma yok', !(await mt.evaluate(() => document.documentElement.scrollWidth > innerWidth)))

  /* yönetim */
  const cy = await b.newContext({ viewport: { width: 1000, height: 1000 }, locale: 'tr-TR' })
  await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  let kayit = null
  await cy.route(`${B}/rest/v1/rpc/tetra_mali_ayar_oku`, r => r.fulfill({ json: { kdv_varsayilan: 10, mali_takip: true, kasa_gorunum: 'buyuk', mutfak_fisi: 'kapali', urunler: {} } }))
  await cy.route(`${B}/rest/v1/rpc/tetra_mutfak_fisi_kaydet`, r => { kayit = r.request().postDataJSON(); r.fulfill({ json: { tamam: true } }) })
  const y = await cy.newPage(); await y.goto(U + '/yonetim/isletme'); await y.waitForSelector('#mutfak-fisi-baslik', { timeout: 20000 }); await bekle(600)
  await y.click('section:has(#mutfak-fisi-baslik) button[role="radio"]:has-text("Mutfakta bas")'); await bekle(500)
  chk('Yönetimden "Mutfakta bas" kaydedilir', kayit?.p_yer === 'mutfak', kayit)
  await y.locator('section:has(#mutfak-fisi-baslik)').screenshot({ path: D + '/3-yonetim-mutfak-fisi.png' })

  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
