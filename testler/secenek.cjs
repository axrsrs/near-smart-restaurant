/* Ürün seçenekleri sınaması: kasada seçim penceresi, fiyat, sepet, sipariş isteği, fişler, mutfak ekranı ve yönetim.
   Veriyi değiştirmez: seçenekler, siparişler ve kayıt çağrıları taklit edilir; menü ve giriş gerçek sunucudan okunur.
   Yerel önizleme: npx vite preview --port 4601. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/secenek.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 240))) }
const bugun = new Date().toISOString().slice(0, 10)
const id = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`

;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const c0 = await b.newContext(); const r0 = await c0.newPage()
  const TOK = await (await r0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await r0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  const menu = await (await r0.request.post(`${B}/rest/v1/rpc/get_menu`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { p_slug: isl.slug } })).json()
  const urun = menu.categories.flatMap(c => c.items).find(u => !u.sold)
  const fiyat = Math.round(urun.price * 100)
  const veri = {
    gruplar: [
      { id: id(1), ad: 'Boy', tur: 'tek', zorunlu: true, en_fazla: null, secenekler: [{ id: id(11), ad: 'Küçük', fiyat: 0, varsayilan: true, aktif: true }, { id: id(12), ad: 'Büyük', fiyat: 3000, varsayilan: false, aktif: true }] },
      { id: id(2), ad: 'Ekstralar', tur: 'coklu', zorunlu: false, en_fazla: 2, secenekler: [{ id: id(21), ad: 'Ekstra peynir', fiyat: 2000, varsayilan: false, aktif: true }, { id: id(22), ad: 'Ekstra sos', fiyat: 1000, varsayilan: false, aktif: true }, { id: id(23), ad: 'Jalapeno', fiyat: 1500, varsayilan: false, aktif: true }] },
      { id: id(3), ad: 'Çıkarılsın', tur: 'coklu', zorunlu: false, en_fazla: null, secenekler: [{ id: id(31), ad: 'Soğansız', fiyat: 0, varsayilan: false, aktif: true }] },
    ],
    urunler: { [urun.id]: [id(1), id(2), id(3)] },
  }
  let son = null
  const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: false, kasa_gorunum: 'liste', mutfak_fisi: 'kasa' }
  const kasa = async (w, h, tema = 'light') => {
    const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })
    await c.addInitScript((x) => { localStorage.setItem('tetra-cihaz', JSON.stringify(x[0])); localStorage.setItem('sr-tema', x[1]); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))); window.__baski = 0; window.print = () => { window.__baski++ } }, [{ anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme }, tema])
    await c.route(`${B}/rest/v1/rpc/**`, (r) => {
      const ad = r.request().url().split('/rpc/')[1].split('?')[0], g = r.request().postDataJSON() || {}
      if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama-sec-' + w, gorunum: null, personel: { id: 'p1', ad: 'Elif', indirim: false }, personel_tanimli: true } })
      if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: [] } })
      if (ad === 'tetra_kasa_secenekler') return r.fulfill({ json: veri })
      if (ad === 'tetra_siparis_olustur') {
        son = g; const k = g.p_kalemler[0]; const sec = veri.gruplar.flatMap(x => x.secenekler.map(s => ({ ...s, grup: x.ad }))).filter(s => (k.secenekler || []).includes(s.id))
        const birim = fiyat + sec.reduce((t, s) => t + s.fiyat, 0)
        return r.fulfill({ json: { tamam: true, siparis: { id: id(90), no: 7, gun: bugun, zaman: new Date().toISOString(), tur: 'burada', durum: 'hazirlaniyor', odeme: 'nakit', toplam: birim * k.adet, takip_kod: 'a'.repeat(32), personel_ad: 'Elif', mali: null, indirim: null, ikram: false,
          kalemler: [{ urun_id: urun.id, ad: urun.name, fiyat: birim, taban: fiyat, adet: k.adet, not: k.not, kdv: 10, secenekler: sec.map(s => ({ grup: s.grup, ad: s.ad, fiyat: s.fiyat })) }] } } })
      }
      return r.continue()
    })
    const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message))
    await p.goto(U + '/kasa'); await p.waitForSelector('main section button', { timeout: 20000 }); await bekle(800); return p
  }
  const tl = (k) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(k / 100)

  const k = await kasa(1180, 900)
  chk('Seçenekli üründe "seçenekli" işareti', await k.isVisible(`button[aria-label^="${urun.name},"] >> text=seçenekli`))
  await k.click(`button[aria-label^="${urun.name},"]`); await k.waitForSelector('text=Sepete ekle')
  chk('Zorunlu tek seçimde varsayılan (Küçük) hazır seçili', (await k.getAttribute('[role="radio"]:has-text("Küçük")', 'aria-checked')) === 'true')
  await k.click('[role="radio"]:has-text("Büyük")'); await k.click('[role="checkbox"]:has-text("Ekstra peynir")'); await k.click('[role="checkbox"]:has-text("Ekstra sos")')
  chk('Çoklu grupta "en fazla 2" sınırı: üçüncü seçenek kapanır', await k.isDisabled('[role="checkbox"]:has-text("Jalapeno")'))
  await k.click('[role="checkbox"]:has-text("Soğansız")')
  const beklenen = fiyat + 3000 + 2000 + 1000
  chk('Pencere toplamı anında güncellenir', (await k.textContent('button:has-text("Sepete ekle")')).includes(tl(beklenen)), await k.textContent('button:has-text("Sepete ekle")'))
  await k.screenshot({ path: D + '/1-secenek-penceresi.png' })
  await k.click('button:has-text("Sepete ekle")'); await bekle(300)
  chk('Sepette seçimler ve fiyat görünür', await k.isVisible('aside >> text=Büyük · Ekstra peynir · Ekstra sos · Soğansız') && (await k.textContent('aside')).includes(tl(beklenen)))
  // aynı seçimle tekrar → aynı satır 2 adet; farklı seçim → yeni satır
  await k.click(`button[aria-label^="${urun.name},"]`); await k.click('[role="radio"]:has-text("Büyük")'); await k.click('[role="checkbox"]:has-text("Ekstra peynir")'); await k.click('[role="checkbox"]:has-text("Ekstra sos")'); await k.click('[role="checkbox"]:has-text("Soğansız")'); await k.click('button:has-text("Sepete ekle")'); await bekle(200)
  await k.click(`button[aria-label^="${urun.name},"]`); await k.click('button:has-text("Sepete ekle")'); await bekle(300)
  const satirlar = await k.$$eval('aside ul > li', l => l.length)
  chk('Aynı seçim birleşir (2 adet), farklı seçim ayrı satır olur', satirlar === 2 && (await k.isVisible('aside [aria-label="2 adet"]')), satirlar)
  await k.screenshot({ path: D + '/2-sepet.png' })
  await k.click('text=Siparişi tamamla'); await k.click('button:has-text("Nakit")'); await k.waitForSelector('text=Sipariş alındı'); await bekle(400)
  const ks = son?.p_kalemler || []
  chk('Sunucuya seçenek kimlikleri gider (fiyat gitmez)', ks.length === 2 && ks.some(x => x.adet === 2 && x.secenekler?.length === 4 && !('fiyat' in x)) && ks.some(x => x.adet === 1 && x.secenekler?.length === 1), ks)
  const fisler = await k.$$eval('.fis-kagit', l => l.map(e => e.textContent))
  chk('Müşteri fişinde seçimler ve fiyat farkları', fisler[0]?.includes('Büyük') && fisler[0]?.includes('Ekstra peynir') && fisler[0]?.includes('+' + tl(2000)), fisler[0])
  chk('Mutfak fişinde seçimler', fisler[1]?.includes('+ Büyük') && fisler[1]?.includes('+ Soğansız'), fisler[1])
  await k.emulateMedia({ media: 'print' }); await bekle(150); await k.locator('.fis-kagit').first().screenshot({ path: D + '/3-musteri-fisi.png' }); await k.locator('.fis-mutfak').screenshot({ path: D + '/4-mutfak-fisi.png' }); await k.emulateMedia({ media: 'screen' })
  await k.click('text=Yeni sipariş')
  // sepete Ekstra peynirli bir satır koy, sonra seçenek kapatılsın: satır düşmeli, pencerede görünmemeli
  await k.click(`button[aria-label^="${urun.name},"]`); await k.click('[role="checkbox"]:has-text("Ekstra peynir")'); await k.click('button:has-text("Sepete ekle")'); await bekle(200)
  veri.gruplar[1].secenekler = veri.gruplar[1].secenekler.filter(s => s.id !== id(21))
  await k.reload(); await k.waitForSelector('main section button'); await bekle(1000)
  chk('Kapatılan seçenekli satır sepetten düşer ve uyarı çıkar', await k.isVisible('text=sepetten çıkarıldı'))
  await k.click(`button[aria-label^="${urun.name},"]`); await k.waitForSelector('button:has-text("Sepete ekle")')
  chk('Kapatılan seçenek pencerede görünmez', (await k.locator('[role="dialog"] >> text=Ekstra peynir').count()) === 0)
  await k.click('button[aria-label="Kapat"]')

  // telefon
  const m = await kasa(390, 844, 'dark'); await m.click(`button[aria-label^="${urun.name},"]`); await m.waitForSelector('button:has-text("Sepete ekle")'); await bekle(300)
  chk('Telefonda seçim penceresi taşmaz', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)))
  await m.screenshot({ path: D + '/5-telefon.png' })

  // mutfak ekranı
  const cm = await b.newContext({ viewport: { width: 1180, height: 820 }, locale: 'tr-TR' })
  await cm.addInitScript((x) => { localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))) }, { anahtar: 'ab'.repeat(32), ekran: 'mutfak', ad: 'Mutfak', isletme })
  await cm.route(`${B}/rest/v1/rpc/**`, (r) => {
    const ad = r.request().url().split('/rpc/')[1].split('?')[0]
    if (ad === 'tetra_cihaz_durum') return r.fulfill({ json: { cihaz: { id: 'c2', ekran: 'mutfak', ad: 'Mutfak' }, isletme, kanal: 'sinama-sec-m', gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true } })
    if (ad === 'tetra_siparisler') return r.fulfill({ json: { gun: bugun, siparisler: [{ id: id(91), no: 8, gun: bugun, zaman: new Date().toISOString(), tur: 'paket', durum: 'hazirlaniyor', personel_ad: 'Elif', kalemler: [{ urun_id: urun.id, ad: urun.name, fiyat: 1, adet: 1, not: '', secenekler: [{ grup: 'Boy', ad: 'Büyük', fiyat: 3000 }, { grup: 'Çıkarılsın', ad: 'Soğansız', fiyat: 0 }] }] }] } })
    return r.continue()
  })
  const mt = await cm.newPage(); await mt.goto(U + '/mutfak'); await mt.waitForSelector(`text=${urun.name}`, { timeout: 20000 }); await bekle(300)
  chk('Mutfak ekranında seçimler görünür', await mt.isVisible('text=Büyük · Soğansız'))
  await mt.screenshot({ path: D + '/6-mutfak-ekrani.png' })

  // yönetim
  const cy = await b.newContext({ viewport: { width: 1100, height: 1000 }, locale: 'tr-TR' })
  await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  let kayit = null, liste = { gruplar: [], urunler: {} }
  await cy.route(`${B}/rest/v1/rpc/tetra_secenek_liste`, r => r.fulfill({ json: liste }))
  await cy.route(`${B}/rest/v1/rpc/tetra_secenek_grup_kaydet`, r => { kayit = r.request().postDataJSON(); const g = kayit.p_grup; liste = { gruplar: [{ ...g, id: id(50), secenekler: g.secenekler.map((s, i) => ({ ...s, id: id(60 + i) })) }], urunler: Object.fromEntries(g.urunler.map(u => [u, [id(50)]])) }; r.fulfill({ json: { tamam: true, id: id(50) } }) })
  await cy.route(`${B}/rest/v1/rpc/tetra_mali_ayar_oku`, r => r.fulfill({ json: { kdv_varsayilan: 10, mali_takip: true, urunler: {} } }))
  const y = await cy.newPage(); await y.goto(U + '/yonetim/menu'); await y.waitForSelector('[role="tab"]:has-text("Seçenek grupları")', { timeout: 20000 })
  await y.click('[role="tab"]:has-text("Seçenek grupları")'); await y.waitForSelector('text=Henüz seçenek grubu yok')
  await y.screenshot({ path: D + '/7-yonetim-bos.png' })
  await y.click('button:has-text("Boy"):has-text("Küçük")'); await y.waitForSelector('#grup-ad')
  chk('Şablon formu doldurur (Boy: tek seçim, zorunlu, 3 seçenek)', (await y.inputValue('#grup-ad')) === 'Boy' && (await y.getAttribute('[role="radio"]:has-text("Tek seçim")', 'aria-checked')) === 'true' && (await y.$$('input[aria-label$="adı"]')).length === 3)
  await y.fill('input[aria-label="Seçenek 3 fiyat farkı (₺)"]', 'abc'); await y.click('button:has-text("Kaydet")'); await bekle(150)
  chk('Geçersiz fiyat tarayıcıda reddedilir', await y.isVisible('text=için geçerli bir fiyat yaz'))
  await y.fill('input[aria-label="Seçenek 3 fiyat farkı (₺)"]', '35'); await y.click('button:has-text("Tümü") >> nth=0'); await y.screenshot({ path: D + '/8-grup-formu.png', fullPage: true })
  await y.click('button:has-text("Kaydet")'); await bekle(600)
  const g = kayit?.p_grup
  chk('Grup sunucuya doğru gider (fiyat kuruş, ürünler)', g?.ad === 'Boy' && g?.tur === 'tek' && g?.zorunlu === true && g?.secenekler?.[2]?.fiyat === 3500 && g?.secenekler?.[0]?.varsayilan === true && g?.urunler?.length > 0, g)
  chk('Liste güncellenir', await y.isVisible('text=Küçük · Orta +₺15,00 · Büyük +₺35,00'))
  await y.click('[role="tab"]:has-text("Ürünler")'); await bekle(300)
  chk('Ürün satırında grup adı görünür', (await y.locator('text=Boy').count()) > 0)

  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
