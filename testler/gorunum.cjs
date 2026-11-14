/* İşletme görünümü sınaması (yerel önizleme: npx vite preview --port 4601). Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/gorunum.cjs <görüntü klasörü> */
const { chromium } = require('playwright')
const U = 'http://localhost:4601', B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2', D = process.argv[2]
const bekle = ms => new Promise(r => setTimeout(r, ms)); let gec = 0, kal = 0
const chk = (ad, ok, d = '') => { ok ? gec++ : kal++; console.log((ok ? '✓ ' : '✗ ') + ad + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 160))) }
;(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
  const yeni = async (w, h, tema = 'light', dsf = 1, ek = {}) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: 'tr-TR', ...ek }); await c.addInitScript(t => { try { localStorage.setItem('sr-tema', t) } catch {} window.print = () => {} }, tema); const p = await c.newPage(); p.on('pageerror', e => console.log('SAYFA HATASI', e.message)); return [c, p] }
  const [c0, p0] = await yeni(600, 400)
  const api = async (ad, g, jwt) => { const r = await p0.request.post(`${B}/rest/v1/rpc/${ad}`, { headers: { apikey: K, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, data: g }); return { s: r.status(), j: await r.json().catch(() => null) } }
  const TOK = await (await p0.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: process.env.TETRA_TEST_EPOSTA, password: process.env.TETRA_TEST_SIFRE } })).json()
  const JWT = TOK.access_token, isl = (await api('tetra_baslangic', {}, JWT)).j.find(x => x.tetra)
  const kaydetApi = (palet, vurgu = null) => api('tetra_gorunum_kaydet', { p_restaurant: isl.id, p_palet: palet, p_vurgu: vurgu }, JWT)
  await kaydetApi('orman')
  // güvenlik
  let r = await api('tetra_gorunum_kaydet', { p_restaurant: isl.id, p_palet: 'bordo', p_vurgu: null })
  chk('Girişsiz kişi görünümü değiştiremez', r.s >= 400 || r.j?.tamam !== true, r)
  r = await kaydetApi('mor-olmayan'); chk('Geçersiz palet reddedilir', r.j?.tamam === false, r.j)
  r = await kaydetApi('gece', 'kirmizi'); chk('Geçersiz renk reddedilir', r.j?.tamam === false, r.j)
  r = await kaydetApi('gece', "#123456'); drop table x;--"); chk('Renk alanına kod sokulamaz', r.j?.tamam === false, r.j)
  // cihazlar
  for (const x of (await api('tetra_cihaz_liste', { p_restaurant: isl.id }, JWT)).j) await api('tetra_cihaz_sil', { p_restaurant: isl.id, p_id: x.id }, JWT)
  for (const x of (await api('tetra_personel_liste', { p_restaurant: isl.id }, JWT)).j) await api('tetra_personel_sil', { p_restaurant: isl.id, p_id: x.id }, JWT)
  console.log('personel', JSON.stringify((await api('tetra_personel_kaydet', { p_restaurant: isl.id, p_id: null, p_ad: 'Elif', p_yetkiler: ['kasa', 'mutfak'], p_pin: '2468', p_aktif: true }, JWT)).j))
  const cihaz = async (ekran) => { const y = (await api('tetra_cihaz_ekle', { p_restaurant: isl.id, p_ekran: ekran, p_ad: 'Görünüm ' + ekran }, JWT)).j; return { anahtar: y.anahtar, ekran, ad: 'Görünüm ' + ekran, isletme: { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo || '' } } }
  const kk = await cihaz('kasa'), km = await cihaz('mutfak')
  const [ck, k] = await yeni(1180, 820); await ck.addInitScript(x => localStorage.setItem('tetra-cihaz', JSON.stringify(x)), kk)
  await k.goto(U + '/kasa'); await k.waitForSelector('text=Personel girişi', { timeout: 20000 }); await bekle(300); await k.keyboard.type('2468'); try { await k.waitForSelector('main section button', { timeout: 20000 }) } catch (e) { await k.screenshot({ path: D + '/hata.png' }); console.log('METIN', (await k.textContent('body')).slice(0, 300)); throw e } await bekle(1500)
  const vurguOku = p => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-gold').trim())
  chk('Kasa varsayılan (Orman) renginde açılır', (await vurguOku(k)) === '#294b39', await vurguOku(k))
  // yönetim: önizleme ve kaydetme
  const [cy, y] = await yeni(1180, 900); await cy.addInitScript(t => localStorage.setItem('tetra-yonetici', JSON.stringify(t)), TOK)
  await y.goto(U + '/yonetim/isletme'); await y.waitForSelector('#gorunum-baslik', { timeout: 30000 }); await bekle(800)
  await y.locator('#gorunum-baslik').scrollIntoViewIfNeeded(); await y.screenshot({ path: D + '/yonetim-1.png', fullPage: true })
  chk('Görünüm bölümünde 8 palet var', await y.locator('[role=radiogroup] [role=radio]').count() === 8)
  await y.locator('[role=radio]:has-text("Bordo")').click(); await bekle(300)
  chk('Palet seçince sayfa anında önizlenir', (await vurguOku(y)) === '#6b1f2a', await vurguOku(y))
  chk('Önizleme kaydedilmeden kasaya gitmez', (await vurguOku(k)) === '#294b39', await vurguOku(k))
  await y.locator('button:has-text("Vazgeç")').click(); await bekle(200)
  chk('Vazgeç kayıtlı görünüme döner', (await vurguOku(y)) === '#294b39', await vurguOku(y))
  await y.locator('[role=radio]:has-text("Gece Mavisi")').click()
  await y.locator('[role=switch][aria-label="Kendi vurgu rengini kullan"]').click()
  await y.locator('#gorunum-renk').evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '#f5d76e'); el.dispatchEvent(new Event('input', { bubbles: true })) }); await bekle(300)
  const v2 = await vurguOku(y)
  chk('Çok açık özel renk açık temada okunur hâle getirilir', v2 !== '#f5d76e' && v2.startsWith('#'), v2)
  const yaziRengi = await y.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-on-gold').trim())
  chk('Vurgu üstündeki yazı rengi otomatik seçilir', yaziRengi === '#111111' || yaziRengi === '#ffffff', yaziRengi)
  await y.screenshot({ path: D + '/yonetim-2.png', fullPage: true })
  await y.locator('button:has-text("Görünümü kaydet")').click(); await y.waitForSelector('[role=status]:has-text("Kaydedildi")', { timeout: 15000 })
  chk('Kaydet çalışır ve onay mesajı çıkar', true)
  r = (await api('tetra_baslangic', {}, JWT)).j.find(x => x.id === isl.id).gorunum
  chk('Seçim sunucuya yazıldı', r?.palet === 'gece' && r?.vurgu === '#f5d76e', r)
  let ok = false; for (let i = 0; i < 20 && !ok; i++) { await bekle(500); ok = (await vurguOku(k)) === v2 }
  chk('Açık duran kasa sayfa yenilenmeden yeni renge geçer', ok, await vurguOku(k))
  await k.screenshot({ path: D + '/kasa-canli.png' })
  // takip sayfası
  const an = kk.anahtar, ot = await k.evaluate(() => JSON.parse(sessionStorage.getItem('tetra-personel-oturum')))
  const menu = (await api('get_menu', { p_slug: 'tetra-test' })).j; const urun = menu.categories.flatMap(x => x.items).find(u => u.name === 'Classic Burger').id
  const sp = (await api('tetra_siparis_olustur', { p_anahtar: an, p_oturum: ot, p_kalemler: [{ urun_id: urun, adet: 1, not: '' }], p_tur: 'paket', p_odeme: 'kart', p_istek: crypto.randomUUID() })).j.siparis
  const kod = (await api('tetra_siparisler', { p_anahtar: an, p_oturum: ot })).j.siparisler.find(x => x.id === sp.id).takip_kod
  const [ct, t] = await yeni(390, 844, 'light', 2, { isMobile: true }); await t.goto(U + '/t/' + kod); await t.waitForSelector('h1', { timeout: 20000 }); await bekle(800)
  chk('Müşteri takip sayfası işletmenin rengini alır', (await vurguOku(t)) === v2, await vurguOku(t)); await t.screenshot({ path: D + '/takip.png' })
  // giriş ekranı NEAR Mono kalır
  const [cg, g] = await yeni(390, 844); await cg.addInitScript(css => localStorage.setItem('tetra-gorunum-css', css), await k.evaluate(() => localStorage.getItem('tetra-gorunum-css')))
  await g.goto(U + '/giris'); await g.waitForSelector('#giris-eposta'); await bekle(500)
  const girisVurgu = await g.evaluate(() => getComputedStyle(document.querySelector('[data-near]')).getPropertyValue('--color-gold').trim())
  chk('Giriş ekranı her palette NEAR Mono kalır', girisVurgu === '#1d5fa8', girisVurgu)
  // her palet: kasa (açık) + birkaç koyu örnek
  for (const p of ['orman', 'near', 'gece', 'bordo', 'kahve', 'mandalina', 'siyah-altin', 'lavanta']) {
    await kaydetApi(p); await bekle(2500); await k.screenshot({ path: `${D}/palet-${p}.png` })
  }
  const [cm, m] = await yeni(1180, 820, 'dark'); await cm.addInitScript(x => localStorage.setItem('tetra-cihaz', JSON.stringify(x)), km)
  await m.goto(U + '/mutfak'); await m.waitForSelector('text=Personel girişi', { timeout: 20000 }); await bekle(300); await m.keyboard.type('2468'); await m.waitForSelector('section[aria-label="Hazırlanıyor"]', { timeout: 20000 })
  for (const p of ['bordo', 'siyah-altin', 'gece']) { await kaydetApi(p); await bekle(2500); await m.screenshot({ path: `${D}/mutfak-koyu-${p}.png` }) }
  await kaydetApi('orman'); await bekle(1500)
  chk('Sona varsayılana (Orman) dönüldü', (await vurguOku(k)) === '#294b39', await vurguOku(k))
  for (const x of (await api('tetra_cihaz_liste', { p_restaurant: isl.id }, JWT)).j) if (x.ad.startsWith('Görünüm')) await api('tetra_cihaz_sil', { p_restaurant: isl.id, p_id: x.id }, JWT)
  console.log(`\n${gec} geçti, ${kal} kaldı`); await b.close(); process.exit(kal ? 1 : 0)
})().catch(e => { console.log('TEST HATASI', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
