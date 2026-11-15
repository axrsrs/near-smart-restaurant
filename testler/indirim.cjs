/* İndirim / ikram / personel yemeği sınaması. Veriyi değiştirmez: cihaz durumu, sipariş ve kayıt çağrıları taklit edilir; menü ve giriş gerçek sunucudan okunur.
   Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/indirim.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 220))) }
const bugun = new Date().toISOString().slice(0, 10)

;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const c0 = await b.newContext(); const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  let son = null, no = 0

  const kasa = async (yetki, w = 1180, h = 900) => {
    const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: false, kasa_gorunum: 'liste', mutfak_fisi: 'kapali' }
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript((x) => { localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))); window.print = () => {} }, { anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme })
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1].split('?')[0], g = r.request().postDataJSON() || {}
      if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama-ind-' + yetki + w, gorunum: null, personel: { id: 'p1', ad: 'Elif', indirim: yetki }, personel_tanimli: true } })
      if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: [] } })
      if (ad === 'tetra_kasa_secenekler') return r.fulfill({ json: { gruplar: [], urunler: {} } }) // seçenek okuması da taklit edilir (sahte cihaz anahtarı sunucuda tanınmaz)
      if (ad === 'tetra_siparis_olustur') {
        son = g; no++
        const brut = 50000, i = g.p_indirim
        const tutar = !i ? 0 : i.tur === 'ikram' ? brut : i.tur === 'tutar' ? i.deger : Math.round(brut * (i.deger ?? 100) / 100)
        return r.fulfill({ json: { tamam: true, siparis: { id: '00000000-0000-4000-8000-00000000000' + no, no, gun: bugun, zaman: new Date().toISOString(), tur: 'burada', durum: 'hazirlaniyor', odeme: g.p_odeme, toplam: brut - tutar, takip_kod: 'a'.repeat(32), personel_ad: 'Elif',
          kalemler: [{ urun_id: 'x', ad: 'Serpme Kahvaltı', fiyat: brut, adet: 1, not: '' }], mali: null, ikram: !!i && (i.tur === 'ikram' || i.tur === 'personel'),
          indirim: i ? { tur: i.tur, deger: i.deger, tutar, brut, aciklama: i.aciklama, kisi: 'Elif' } : null } } })
      }
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message))
    await p.goto(U + '/kasa'); await p.waitForSelector('main section button', { timeout: 20000 }); await bekle(600); return p
  }
  const odemeAc = async (p) => { await p.locator('main section button:not([disabled])').first().click(); await p.click('text=Siparişi tamamla'); await p.waitForSelector('text=Ödeme') }

  // yetkisiz
  const y0 = await kasa(false); await odemeAc(y0)
  chk('Yetkisi olmayan personelde "İndirim / ikram" görünmez', !(await y0.isVisible('text=İndirim / ikram')))

  // yüzde
  const k = await kasa(true); await odemeAc(k)
  await k.click('text=İndirim / ikram'); await k.click('button[aria-pressed]:has-text("%10")'); await k.fill('#indirim-aciklama', 'Öğrenci'); await bekle(100)
  const onizleme = await k.textContent('p[aria-live="polite"].tabular-nums')
  await k.screenshot({ path: D + '/1-indirim-paneli.png' })
  await k.click('button:has-text("Uygula")'); await bekle(200)
  chk('Uygulanınca ödenecek tutar ve indirim satırı görünür', await k.isVisible('text=İndirim %10') && (await k.locator('p.line-through').count()) === 1, onizleme)
  await k.screenshot({ path: D + '/2-odeme-indirimli.png' })
  await k.click('button:has-text("Nakit")'); await k.waitForSelector('text=Sipariş alındı')
  chk('Sunucuya indirim isteği gider (%10, gerekçe)', son?.p_indirim?.tur === 'yuzde' && son?.p_indirim?.deger === 10 && son?.p_indirim?.aciklama === 'Öğrenci', son?.p_indirim)
  const fis = await k.textContent('.fis-kagit')
  chk('Fişte ara toplam, indirim ve net toplam', fis.includes('Ara toplam') && fis.includes('İndirim %10') && fis.includes('−₺50,00') && fis.includes('₺450,00'), fis)
  await k.emulateMedia({ media: 'print' }); await bekle(150); await k.locator('.fis-kagit').screenshot({ path: D + '/3-indirimli-fis.png' }); await k.emulateMedia({ media: 'screen' })
  await k.click('text=Yeni sipariş')

  // ikram
  await odemeAc(k); await k.click('text=İndirim / ikram'); await k.click('button[role="radio"]:has-text("İkram")'); await k.click('button:has-text("Uygula")'); await bekle(150)
  chk('İkramda gerekçe zorunlu', await k.isVisible('text=Kime ya da neden ikram edildiğini yaz.'))
  await k.fill('#indirim-aciklama', 'Doğum günü'); await k.click('button:has-text("Uygula")'); await bekle(150)
  chk('İkramda tek düğme: "Tamamla (ödeme yok)"', await k.isVisible('button:has-text("Tamamla (ödeme yok)")') && !(await k.isVisible('button:has-text("Kart")')))
  await k.click('button:has-text("Tamamla (ödeme yok)")'); await k.waitForSelector('text=Sipariş alındı')
  chk('İkram siparişi ₺0,00 ve "İkram" olarak kaydedilir', son?.p_indirim?.tur === 'ikram' && (await k.isVisible('text=Burada · İkram · ₺0,00')))
  await k.click('text=Yeni sipariş')

  // ₺ indirim: sepetten büyük olamaz
  await odemeAc(k); await k.click('text=İndirim / ikram'); await k.click('button[role="radio"]:has-text("₺ indirim")'); await k.fill('#indirim-deger', '999999'); await k.click('button:has-text("Uygula")'); await bekle(150)
  chk('₺ indirim sipariş tutarını aşamaz', await k.isVisible('text=İndirim tutarı 0 ile sipariş tutarı arasında olmalı.'))
  await k.click('button:has-text("Vazgeç")'); await bekle(100)
  chk('Vazgeçince indirim uygulanmaz', !(await k.isVisible('p.line-through')))
  await k.click('button[aria-label="Kapat"]').catch(() => {})

  // telefon
  const m = await kasa(true, 390, 844)
  await m.locator('main section button:not([disabled])').first().click(); await m.click('button:has-text("Sepet ·")'); await m.click('[role="dialog"] button:has-text("Siparişi tamamla")'); await m.click('text=İndirim / ikram'); await bekle(300)
  chk('Telefonda indirim paneli taşmaz', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
  await m.screenshot({ path: D + '/4-telefon.png' })

  // yönetim: personel yetkisi
  const cy = await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'tr-TR' })
  await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  let kayit = null
  await cy.route(`${B}/rest/v1/rpc/tetra_personel_liste`, r => r.fulfill({ json: [{ id: '00000000-0000-4000-8000-000000000077', ad: 'Elif', yetkiler: ['kasa'], aktif: true, indirim: false }] }))
  await cy.route(`${B}/rest/v1/rpc/tetra_personel_kaydet`, r => { kayit = r.request().postDataJSON(); r.fulfill({ json: { tamam: true } }) })
  const y = await cy.newPage(); await y.goto(U + '/yonetim/personel'); await y.waitForSelector('button[aria-label="Elif: düzenle"]', { timeout: 20000 })
  await y.click('button[aria-label="Elif: düzenle"]'); await y.click('button[role="switch"][aria-label="İndirim ve ikram yapabilir"]'); await y.screenshot({ path: D + '/5-personel-yetki.png' })
  await y.click('button[type="submit"]'); await bekle(500)
  chk('Personele indirim yetkisi verilir', kayit?.p_indirim === true && kayit?.p_pin === '', kayit)

  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
