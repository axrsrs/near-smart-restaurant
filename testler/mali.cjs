/* Mali fiş ve KDV arayüz sınaması. Veriyi değiştirmez: yazma çağrıları ve sipariş verisi taklit edilir,
   yalnızca menü ve giriş gerçek sunucudan okunur. Yerel önizleme: npx vite preview --port 4601.
   Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/mali.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = process.env.U || 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 200))) }
const simdi = new Date().toISOString(), bugun = simdi.slice(0, 10)
const sip = (no, toplam, durum, mali, odeme = 'nakit') => ({ id: `00000000-0000-4000-8000-00000000000${no}`, no, gun: bugun, zaman: simdi, tur: 'burada', durum, odeme, toplam, takip_kod: 'a'.repeat(32), personel_ad: 'Elif',
  kalemler: [{ urun_id: '00000000-0000-4000-8000-000000000099', ad: 'Tavuk Dürüm', fiyat: toplam, adet: 1, not: '', kdv: 10 }], mali })
const bek = { durum: 'bekliyor', fis_no: null, zaman: null, kisi: null }
const kes = (no) => ({ durum: 'kesildi', fis_no: no, zaman: simdi, kisi: 'Elif' })

;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const yeni = async (w, h, tema = 'light') => { const c = await b.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' }); await c.addInitScript(t => { try { localStorage.setItem('sr-tema', t) } catch {} window.print = () => {} }, tema); const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message)); return [c, p] }
  const [c0, p0] = await yeni(600, 400)
  const TOK = await (await p0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const isl = (await (await p0.request.post(`${B}/rest/v1/rpc/tetra_baslangic`, { headers: { apikey: K, Authorization: 'Bearer ' + TOK.access_token, 'Content-Type': 'application/json' }, data: {} })).json()).find(x => x.tetra)
  const isletme = { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '', mali: true }

  /* ───── kasa (tamamen taklit) ───── */
  let liste = [sip(3, 12000, 'hazirlaniyor', bek, 'kart'), sip(2, 8000, 'hazir', kes('0042')), sip(1, 5000, 'iptal', bek)]
  const cagrilar = []
  const taklit = async (ctx, ozel = {}) => ctx.route(`${B}/rest/v1/rpc/**`, async (route) => {
    const ad = route.request().url().split('/rpc/')[1].split('?')[0], g = route.request().postDataJSON() || {}
    cagrilar.push({ ad, g })
    if (ad in ozel) return route.fulfill({ json: typeof ozel[ad] === 'function' ? ozel[ad](g) : ozel[ad] })
    return route.continue() // menü vb. gerçek sunucudan okunur
  })
  const [ck, k] = await yeni(1180, 820)
  await ck.addInitScript(x => { localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))) }, { anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme })
  await taklit(ck, {
    tetra_cihaz_durum: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama-' + Date.now(), gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true },
    tetra_siparisler: () => ({ gun: bugun, siparisler: liste }),
    tetra_siparis_olustur: () => { const s = sip(4, 15500, 'hazirlaniyor', bek); liste = [s, ...liste]; return { tamam: true, siparis: s } },
    tetra_mali_isaretle: (g) => {
      if (g.p_fis_no && !/^[0-9A-Za-zÇĞİÖŞÜçğıöşü /.-]+$/.test(g.p_fis_no)) return { tamam: false, hata: 'Fiş numarasında yalnızca harf, rakam, boşluk, / . - olabilir.' }
      liste = liste.map(s => s.id === g.p_id ? { ...s, mali: g.p_kesildi ? kes(g.p_fis_no) : bek } : s); return { tamam: true, siparis: liste.find(s => s.id === g.p_id) }
    },
  })
  await k.goto(U + '/kasa'); await k.waitForSelector('main section button', { timeout: 20000 }); await bekle(800)
  await k.locator('main section button:not([disabled])').first().click(); await k.click('text=Siparişi tamamla'); await k.click('button:has-text("Nakit")')
  await k.waitForSelector('text=Mali fiş bekliyor'); await bekle(300)
  chk('Sipariş alındı penceresinde "Mali fiş bekliyor" görünür', await k.isVisible('text=Yazarkasadan fişi kesince işaretle'))
  await k.screenshot({ path: D + '/1-kasa-siparis-alindi.png' })
  await k.fill('input[aria-label="Mali fiş numarası (isteğe bağlı)"]', 'a<b'); await k.click('button:has-text("Kesildi")'); await bekle(200)
  chk('Geçersiz fiş numarası tarayıcıda reddedilir', await k.isVisible('text=Fiş numarasında yalnızca'))
  await k.fill('input[aria-label="Mali fiş numarası (isteğe bağlı)"]', '0057'); await k.click('button:has-text("Kesildi")')
  await k.waitForSelector('text=Mali fiş kesildi'); await bekle(200)
  const son = cagrilar.filter(x => x.ad === 'tetra_mali_isaretle').pop()
  chk('İşaret sunucuya fiş numarasıyla gider', son?.g.p_kesildi === true && son?.g.p_fis_no === '0057', son)
  chk('Pencere "kesildi · No 0057" gösterir', await k.isVisible('text=No 0057'))
  await k.screenshot({ path: D + '/2-kasa-kesildi.png' })
  await k.click('text=Yeni sipariş'); await k.click('button[aria-label^="Bugünkü siparişler"]'); await k.waitForSelector('text=mali fişi bekliyor'); await bekle(300)
  chk('Liste: bekleyen sayısı uyarısı (1 sipariş)', await k.isVisible('text=1 siparişin'))
  chk('İptal siparişte mali işaret görünmez', (await k.locator('li:has-text("İptal") >> text=Mali fiş').count()) === 0)
  await k.screenshot({ path: D + '/3-kasa-liste.png' })
  await k.click('li:has-text("Mali fiş bekliyor") >> button:has-text("Fiş kesildi")'); await bekle(500)
  chk('Listeden tek dokunuşla işaretlenir', !(await k.isVisible('text=mali fişi bekliyor')))
  await k.click('button[aria-label="2 numaralı siparişi iptal et"]'); await bekle(200)
  chk('Fişi kesilmiş sipariş iptalinde iade uyarısı çıkar', await k.isVisible('text=iptal ya da iade fişi'))
  await k.screenshot({ path: D + '/4-kasa-iptal-uyari.png' })

  /* ───── telefon ───── */
  const [cm, m] = await yeni(390, 844, 'dark')
  await cm.addInitScript(x => { localStorage.setItem('tetra-cihaz', JSON.stringify(x)); sessionStorage.setItem('tetra-personel-oturum', JSON.stringify('cd'.repeat(32))) }, { anahtar: 'ab'.repeat(32), ekran: 'kasa', ad: 'Kasa', isletme })
  liste = [sip(3, 12000, 'hazirlaniyor', bek, 'kart'), sip(2, 8000, 'hazir', kes('0042'))]
  await taklit(cm, { tetra_cihaz_durum: { cihaz: { id: 'c1', ekran: 'kasa', ad: 'Kasa' }, isletme, kanal: 'sinama2', gorunum: null, personel: { id: 'p1', ad: 'Elif' }, personel_tanimli: true }, tetra_siparisler: () => ({ gun: bugun, siparisler: liste }) })
  await m.goto(U + '/kasa'); await m.waitForSelector('main section button', { timeout: 20000 }); await m.click('button[aria-label^="Bugünkü siparişler"]'); await bekle(600)
  const tasma = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  chk('Telefonda yatay taşma yok', !tasma)
  await m.screenshot({ path: D + '/5-telefon-liste.png' })

  /* ───── yönetim (giriş gerçek, veri taklit; yazma çağrıları sunucuya gitmez) ───── */
  const [cy, y] = await yeni(1180, 900); await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  await cy.addInitScript(id => localStorage.setItem('tetra-isletme', JSON.stringify(id)), isl.id)
  let ayar = { kdv_varsayilan: 10, mali_takip: true, urunler: {} }
  await taklit(cy, {
    tetra_mali_ayar_oku: () => ayar,
    tetra_mali_ayar_kaydet: (g) => { ayar = { ...ayar, kdv_varsayilan: g.p_kdv_varsayilan, mali_takip: g.p_mali_takip }; return { tamam: true } },
    tetra_kdv_kaydet: (g) => { if (g.p_oran) ayar.urunler[g.p_urun] = g.p_oran; else delete ayar.urunler[g.p_urun]; return { tamam: true } },
    tetra_mali_bekleyen: [sip(7, 23000, 'teslim', bek, 'kart'), sip(5, 9500, 'teslim', bek)],
    tetra_mali_isaretle_sahip: { tamam: true },
    tetra_rapor: { ozet: { siparis: 12, iptal: 1, ciro: 248000, nakit: 98000, kart: 150000, burada: 8, paket: 4 }, gunler: [{ gun: bugun, siparis: 12, iptal: 1, ciro: 248000, nakit: 98000, kart: 150000, burada: 8, paket: 4 }],
      urunler: [{ ad: 'Tavuk Dürüm', adet: 9, ciro: 135000 }, { ad: 'Efes 50 cl', adet: 4, ciro: 48000 }], kdv: [{ oran: 10, tutar: 200000, kdv: 18182 }, { oran: 20, tutar: 48000, kdv: 8000 }], mali: { bekleyen: 2, bekleyen_tutar: 32500 } },
  })
  await y.goto(U + '/yonetim/isletme'); await y.waitForSelector('text=Mali fiş ve KDV', { timeout: 20000 }); await bekle(500)
  await y.click('#mali-baslik'); await y.click('button[role="radio"]:has-text("%20")'); await y.click('section:has(#mali-baslik) >> button:has-text("Kaydet")'); await bekle(300)
  const ak = cagrilar.filter(x => x.ad === 'tetra_mali_ayar_kaydet').pop()
  chk('Varsayılan KDV kaydı sunucuya %20 olarak gider', ak?.g.p_kdv_varsayilan === 20 && ak?.g.p_mali_takip === true, ak)
  await y.locator('section:has(#mali-baslik)').screenshot({ path: D + '/6-yonetim-mali-ayar.png' })
  await y.goto(U + '/yonetim/menu'); await y.waitForSelector('button[aria-label$=": düzenle"]', { timeout: 20000 }); await bekle(400)
  await y.locator('button[aria-label$=": düzenle"]').first().click(); await y.selectOption('#urun-kdv', '20'); await y.screenshot({ path: D + '/7-menu-kdv.png' })
  await y.click('button[type="submit"]'); await bekle(800)
  const kk = cagrilar.filter(x => x.ad === 'tetra_kdv_kaydet').pop()
  chk('Ürün KDV oranı kaydedilir', kk?.g.p_oran === 20, kk)
  chk('Menü satırında KDV %20 etiketi görünür', await y.isVisible('text=KDV %20'))
  chk('Ürün kaydında NearMenu tablosuna yazılmadı (ad/fiyat değişmedi)', !cagrilar.some(x => x.ad === 'tetra_menu_duyur'))
  await y.goto(U + '/yonetim/raporlar'); await y.waitForSelector('text=KDV kırılımı', { timeout: 20000 }); await bekle(500)
  chk('Raporda KDV %10 ve %20 satırları', await y.isVisible('text=KDV %10') && await y.isVisible('text=Matrah'))
  chk('Raporda fişi kesilmemiş uyarısı', await y.isVisible('text=Mali fişi kesilmemiş 2 sipariş'))
  await y.click('text=Listeyi göster'); await bekle(300)
  await y.screenshot({ path: D + '/8-rapor.png', fullPage: true })
  await y.locator('button:has-text("Fiş kesildi")').first().click(); await bekle(400)
  chk('Yönetimden işaretlenen sipariş listeden düşer', (await y.locator('button:has-text("Fiş kesildi")').count()) === 1)

  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
