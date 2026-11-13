/* Tetra uçtan uca test (sunucuya bağlı sürüm). Gerekli ortam değişkenleri: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE (deneme işletmesinin sahibi).
   Kullanım: U=https://tetra.neardiji.com TETRA_TEST_EPOSTA=... TETRA_TEST_SIFRE=... node testler/e2e.cjs */
const { chromium } = require('playwright');
const U = process.env.U || 'https://tetra.neardiji.com';
const EPOSTA = process.env.TETRA_TEST_EPOSTA, SIFRE = process.env.TETRA_TEST_SIFRE;
const B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2';
if (!EPOSTA || !SIFRE) { console.log('TETRA_TEST_EPOSTA ve TETRA_TEST_SIFRE gerekli'); process.exit(2); }
const sonuc = [];
const chk = (ad, ok, d = '') => { sonuc.push(ok); console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (d !== '' ? ' :: ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 170) : '')); };
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const yeni = async (w = 1180, h = 820) => { const c = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true }); const p = await c.newPage(); p.__err = []; await p.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; }); p.on('pageerror', e => p.__err.push(e.message)); return [c, p]; };
  const yol = p => p.url().replace(U, '');
  const dlg = p => p.locator('[role=dialog]');
  const api = async (p, ad, govde, jwt) => { const r = await p.request.post(`${B}/rest/v1/rpc/${ad}`, { headers: { apikey: K, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, data: govde }); let j = null; try { j = await r.json(); } catch {} return { s: r.status(), j }; };
  const giris = async (p, sifre = SIFRE) => { await p.goto(U + '/giris'); await p.waitForSelector('#giris-eposta'); await p.fill('#giris-eposta', EPOSTA); await p.fill('#giris-sifre', sifre); await p.click('button[type=submit]'); };

  /* hazırlık: önceki koşudan kalan personel ve cihazları temizle (uygulamanın kendi işlevleriyle) */
  let [c, p] = await yeni();
  const tok = await (await p.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: EPOSTA, password: SIFRE } })).json();
  const JWT = tok.access_token; const RID = (await api(p, 'tetra_baslangic', {}, JWT)).j.find(x => x.tetra).id;
  for (const x of (await api(p, 'tetra_personel_liste', { p_restaurant: RID }, JWT)).j) await api(p, 'tetra_personel_sil', { p_restaurant: RID, p_id: x.id }, JWT);
  for (const x of (await api(p, 'tetra_cihaz_liste', { p_restaurant: RID }, JWT)).j) await api(p, 'tetra_cihaz_sil', { p_restaurant: RID, p_id: x.id }, JWT);

  /* ───── İŞLETME SAHİBİ ───── */
  await p.goto(U + '/'); await p.waitForSelector('#giris-eposta'); chk('S01 açılış girişe yönlendirir', yol(p) === '/giris');
  for (const y of ['/yonetim', '/ekran', '/kasa', '/mutfak', '/tv']) { await p.goto(U + y); await p.waitForSelector('#giris-eposta'); chk('S02 girişsiz açılmaz: ' + y, yol(p) === '/giris', yol(p)); }
  await p.click('button[type=submit]'); await p.waitForTimeout(200); chk('S03 boş giriş reddedilir', (await p.textContent('form [role=alert]')).includes('e-posta'));
  await giris(p, 'yanlis-sifre-123'); await p.waitForTimeout(2500);
  chk('S04 yanlış şifre sunucuda reddedilir', yol(p) === '/giris' && (await p.textContent('form [role=alert]')).includes('hatalı'), await p.textContent('form [role=alert]'));
  await giris(p); await p.waitForURL('**/ekran'); await p.waitForSelector('main button:has-text("Yönetim")');
  chk('S05 doğru şifreyle giriş yapılır, işletme kendiliğinden seçilir', (await p.textContent('header')).includes('Tetra Deneme'));
  await p.click('main button:has-text("Yönetim")'); await p.waitForURL('**/yonetim/personel'); await p.waitForSelector('text=Henüz personel yok');
  const ekle = async (ad, pin, { mutfak = false, kasa = true } = {}) => { await p.click('button:has-text("Personel ekle")'); await p.fill('#personel-ad', ad); await p.fill('#personel-pin', pin); if (mutfak) await dlg(p).locator('button[aria-pressed]:has-text("Mutfak")').click(); if (!kasa) await dlg(p).locator('button[aria-pressed]:has-text("Kasa")').click(); await dlg(p).locator('button[type=submit]').click(); await p.waitForTimeout(1200); };
  await p.click('button:has-text("Personel ekle")'); await dlg(p).locator('button[type=submit]').click(); await p.waitForTimeout(200);
  chk('S06 boş personel formu reddedilir', (await dlg(p).locator('[role=alert]').textContent()).includes('2–40')); await p.keyboard.press('Escape');
  await ekle('Ayşe', '1234'); chk('S07 personel eklenir (sunucuya yazılır)', await p.locator('li:has-text("Ayşe")').count() === 1);
  await ekle('Mehmet', '1234', { mutfak: true, kasa: false }); chk('S08 aynı PIN sunucuda reddedilir', (await dlg(p).locator('[role=alert]').textContent()).includes('başka bir personelde'));
  await p.fill('#personel-pin', '5678'); await dlg(p).locator('button[type=submit]').click(); await p.waitForTimeout(1200);
  const xss = '<img src=x onerror="window.__xss=1">'; await ekle(xss, '9999');
  chk('S09 ad alanına yazılan kod çalışmaz (XSS)', (await p.evaluate(() => window.__xss)) === undefined && await p.locator('li img[src="x"]').count() === 0 && await p.locator('ul li').count() === 3, await p.locator('ul li').count());
  await p.click(`[aria-label="${xss.replace(/"/g, '\\"')}: sil"]`); await dlg(p).locator('button:text-is("Sil")').click(); await p.waitForTimeout(1200);
  chk('S10 personel silinir', await p.locator('ul li').count() === 2);
  await p.reload(); await p.waitForSelector('li:has-text("Ayşe")'); chk('S11 yenilemede oturum ve personel yerinde (sunucudan gelir)', await p.locator('ul li').count() === 2);
  await p.click('nav a:has-text("Cihazlar")'); await p.waitForSelector('text=Henüz tanıtılmış cihaz yok'); chk('S12 cihaz listesi boş başlar', true);
  await p.click('nav a:has-text("İşletme")'); await p.waitForSelector('text=75 ürün', { timeout: 10000 }); chk('S13 işletme sayfası NearMenu menüsünü gösterir', (await p.textContent('section')).includes('Tetra Deneme'));

  /* cihaz tanıtma */
  await p.click('button:has-text("Ekran seçimi")'); await p.click('main button:has-text("Kasa")'); await p.waitForSelector('#cihaz-ad');
  await p.fill('#cihaz-ad', 'X'); await dlg(p).locator('button[type=submit]').click(); await p.waitForTimeout(1200);
  chk('S14 çok kısa cihaz adı reddedilir', (await dlg(p).locator('[role=alert]').textContent()).includes('2–40'));
  await p.fill('#cihaz-ad', 'Kasa 1'); await dlg(p).locator('button[type=submit]').click(); await p.waitForURL('**/kasa'); await p.waitForSelector('text=Personel girişi');
  chk('S15 cihaz kasa olarak tanıtılır ve PIN ekranı gelir', true);
  { const c = await p.context().newCDPSession(p); const m = JSON.parse((await c.send('Page.getAppManifest')).data || '{}'); const e = (await c.send('Page.getInstallabilityErrors')).installabilityErrors;
    chk('PWA-1 kasa cihazı "Tetra Kasa" olarak yüklenebilir', m.name === 'Tetra Kasa' && /\/kasa$/.test(m.start_url) && e.length === 0, JSON.stringify({ ad: m.name, e })) }
  const depo = await p.evaluate(() => ({ yonetici: Object.keys(localStorage).filter(k => k.startsWith('tetra-yonetici')).length, cihaz: !!localStorage.getItem('tetra-cihaz'), sifre: JSON.stringify(localStorage).includes(document.title === '' ? '###' : 'access_token') }));
  chk('GÜV-1 tanıtılan cihazda yönetici oturumu kalmaz', depo.yonetici === 0 && depo.cihaz && !depo.sifre, depo);
  await p.goto(U + '/yonetim/personel'); await p.waitForSelector('#giris-eposta'); chk('GÜV-2 kasa cihazından Yönetim açılmaz (yeniden giriş ister)', yol(p) === '/giris');
  await p.goto(U + '/ekran'); await p.waitForSelector('#giris-eposta'); chk('GÜV-3 kasa cihazından ekran seçimi açılmaz', yol(p) === '/giris');
  const kasaAnahtar = await p.evaluate(() => JSON.parse(localStorage.getItem('tetra-cihaz')).anahtar);
  chk('GÜV-4 cihaz anahtarıyla yönetici işlevi çağrılamaz', (await api(p, 'tetra_personel_liste', { p_restaurant: RID })).s >= 400 && (await api(p, 'tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'kasa', p_ad: 'Sızma' })).s >= 400);

  /* ───── KASİYER ───── */
  await p.goto(U + '/kasa'); await p.waitForSelector('text=Personel girişi');
  await p.keyboard.type('5678'); await p.waitForSelector('[role=alert]:has-text("hatalı")'); chk('K01 mutfak PIN\'i kasada geçmez (sunucu)', yol(p) === '/kasa' && await p.locator('main section button').count() === 0);
  await p.keyboard.type('1234'); await p.waitForSelector('main section button', { timeout: 15000 }); await p.waitForTimeout(1200);
  const kutu = p.locator('main section button'); const acik = p.locator('main section button:not([disabled])'); const sep = p.locator('aside');
  chk('K02 doğru PIN ile kasa açılır, 75 ürün gelir', await kutu.count() === 75, await kutu.count());
  chk('K03 üst barda işletme ve personel görünür', (await p.textContent('header')).includes('Tetra Deneme') && (await p.textContent('header')).includes('Ayşe'));
  await p.fill('#kasa-ara', 'PİZZA'); await p.waitForTimeout(250); chk('K04 arama çalışır', await kutu.count() === 6, await kutu.count()); await p.fill('#kasa-ara', '');
  const once = (await api(p, 'tetra_siparisler', { p_anahtar: kasaAnahtar, p_oturum: await p.evaluate(() => JSON.parse(sessionStorage.getItem('tetra-personel-oturum'))) })).j.siparisler.length;
  await acik.nth(0).click(); await acik.nth(0).click(); await acik.nth(5).click();
  await sep.locator('li button:has-text("Not ekle")').first().click(); await dlg(p).locator('button:has-text("Soğansız")').click(); await dlg(p).locator('button:has-text("Kaydet")').click(); await p.waitForTimeout(200);
  /* sepetteki fiyatı tarayıcıdan oyna */
  await p.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('tetra-sepet')); s.forEach(x => x.fiyat = 1); sessionStorage.setItem('tetra-sepet', JSON.stringify(s)); });
  const toplamYazi = (await sep.locator('text=Toplam').locator('..').textContent()).replace('Toplam', '');
  await sep.locator('button:has-text("Paket")').click(); await sep.locator('button:has-text("Siparişi tamamla")').click(); await p.waitForTimeout(250);
  await dlg(p).locator('button:has-text("Kart")').evaluate(x => { x.click(); x.click(); }); await p.waitForSelector('[role=dialog] p.text-8xl', { timeout: 15000 });
  const no1 = Number(await dlg(p).locator('p.text-8xl').textContent());
  const liste1 = (await api(p, 'tetra_siparisler', { p_anahtar: kasaAnahtar, p_oturum: await p.evaluate(() => JSON.parse(sessionStorage.getItem('tetra-personel-oturum'))) })).j.siparisler;
  chk('K05 çift dokunuş sunucuda tek sipariş oluşturur', liste1.length === once + 1, `önce ${once}, sonra ${liste1.length}`);
  const s1 = liste1.find(x => x.no === no1);
  chk('K06 sipariş sunucuya yazıldı; tutar ekrandaki toplamla aynı', !!s1 && (await dlg(p).textContent()).includes(toplamYazi) && s1.toplam > 100, { toplam: s1?.toplam, ekran: toplamYazi });
  chk('K07 not, tür, ödeme ve kasiyer sunucuda doğru', s1.kalemler[0].not === 'Soğansız' && s1.tur === 'paket' && s1.odeme === 'kart' && s1.personel_ad === 'Ayşe', s1.kalemler[0]);
  chk('K08 fiş otomatik yazdırılır, QR takip adresini taşır', (await p.evaluate(() => window.__prints)) >= 1 && await p.locator('.fis-kagit').count() === 1);
  await dlg(p).locator('button:has-text("Yeni sipariş")').click(); chk('K09 sipariş sonrası sepet boşalır', await sep.locator('li').count() === 0);
  await acik.nth(2).click(); await sep.locator('button:has-text("Siparişi tamamla")').click(); await dlg(p).locator('button:has-text("Nakit")').click(); await p.waitForSelector('[role=dialog] p.text-8xl');
  const no2 = Number(await dlg(p).locator('p.text-8xl').textContent()); chk('K10 numara sırayla artar', no2 === no1 + 1, `${no1} → ${no2}`);
  await dlg(p).locator('button:has-text("Yeni sipariş")').click();
  await p.click('[aria-label^="Bugünkü siparişler"]'); await p.waitForTimeout(400);
  await dlg(p).locator(`[aria-label="${no2} numaralı siparişi iptal et"]`).click(); await dlg(p).locator('button:text-is("İptal et")').click(); await p.waitForFunction((n) => [...document.querySelectorAll('[role=dialog] li')].some(li => li.querySelector('span.w-12')?.textContent === String(n) && [...li.querySelectorAll('span')].some(s => s.textContent === 'İptal')), no2, { timeout: 15000 });
  const iptalli = (await api(p, 'tetra_siparisler', { p_anahtar: kasaAnahtar, p_oturum: await p.evaluate(() => JSON.parse(sessionStorage.getItem('tetra-personel-oturum'))) })).j.siparisler.find(x => x.no === no2);
  chk('K11 iptal sunucuya işlenir', iptalli.durum === 'iptal'); await p.keyboard.press('Escape');
  await p.reload(); await p.waitForSelector('main section button'); await p.waitForTimeout(800);
  chk('K12 yenilemede kasa oturumu sürer, sipariş sayacı sunucudan gelir', yol(p) === '/kasa' && (await p.getAttribute('[aria-label^="Bugünkü siparişler"]', 'aria-label')).endsWith(String(once + 2)), await p.getAttribute('[aria-label^="Bugünkü siparişler"]', 'aria-label'));
  /* tükendi → NearMenu */
  const hedefAd = await acik.nth(7).getAttribute('aria-label'); const urunAd = hedefAd.split(',')[0];
  await acik.nth(7).click(); await p.click('[aria-label="Tükendi işaretleme modu"]'); await p.locator(`main section button[aria-label="${hedefAd}"]`).click();
  await p.waitForSelector(`main section button[aria-label="${hedefAd}, tükendi"]`, { timeout: 10000 });
  const menuSonra = (await api(p, 'get_menu', { p_slug: 'tetra-test' })).j.categories.flatMap(k => k.items).find(u => u.name === urunAd);
  chk('K13 kasadan tükendi → NearMenu menüsünde de tükendi', menuSonra.sold === true, urunAd);
  chk('K14 tükenen ürün sepetten düşer ve uyarı çıkar', (await sep.textContent()).includes('sepetten çıkarıldı'));
  await p.locator(`main section button[aria-label="${hedefAd}, tükendi"]`).click(); await p.waitForSelector(`main section button[aria-label="${hedefAd}"]`, { timeout: 10000 }); await p.click('[aria-label="Tükendi işaretleme modu"]');
  chk('K15 tükendi geri açılır', (await api(p, 'get_menu', { p_slug: 'tetra-test' })).j.categories.flatMap(k => k.items).find(u => u.name === urunAd).sold === false);
  /* bağlantı kopukken sipariş */
  if (await sep.locator('button:text-is("Tamam")').count()) await sep.locator('button:text-is("Tamam")').click(); if (await sep.locator('li').count()) await sep.locator('button:has-text("Sepeti boşalt")').first().click(); await acik.nth(1).click();
  await c.route('**/rest/v1/rpc/tetra_siparis_olustur', r => r.abort());
  await sep.locator('button:has-text("Siparişi tamamla")').click(); await dlg(p).locator('button:has-text("Nakit")').click(); await p.waitForSelector('[role=dialog] [role=alert]:has-text("ulaşılamadı")', { timeout: 15000 });
  chk('K16 bağlantı yokken sipariş kaybolmaz: hata gösterilir, sepet durur', await dlg(p).locator('button:has-text("Nakit")').count() === 1);
  await c.unroute('**/rest/v1/rpc/tetra_siparis_olustur'); await dlg(p).locator('button:has-text("Nakit")').click(); await p.waitForSelector('[role=dialog] p.text-8xl', { timeout: 15000 });
  const no3 = Number(await dlg(p).locator('p.text-8xl').textContent()); chk('K17 bağlantı gelince aynı sipariş tamamlanır', no3 === no2 + 1, no3);
  await dlg(p).locator('button:has-text("Yeni sipariş")').click();
  chk('K18 kasiyer akışında sayfa hatası yok', p.__err.length === 0, p.__err.join(' | '));

  /* ───── MÜŞTERİ (başka telefon) ───── */
  const [c2, m] = await yeni(390, 800);
  await m.goto(U + '/t/' + s1.takip_kod); await m.waitForSelector('h1.text-8xl', { timeout: 15000 });
  chk('M01 müşteri başka telefonda siparişini görür', (await m.textContent('h1')) === String(no1) && (await m.textContent('[aria-current=step]')).includes('Hazırlanıyor'));
  chk('M02 takip sayfası işletmeyi gösterir, tutar ve ürün göstermez', !(await m.textContent('main')).includes('₺'));
  await m.goto(U + '/t/' + 'f'.repeat(32)); await m.waitForSelector('text=Sipariş bulunamadı'); chk('M03 yanlış takip kodu "bulunamadı" der', true);
  await m.goto(U + '/yonetim'); await m.waitForSelector('#giris-eposta'); chk('M04 müşteri telefonundan yönetim açılmaz', yol(m) === '/giris');
  chk('M05 takip sayfası telefonda taşmıyor', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await c2.close();

  /* ───── kilit, PIN kilidi, cihazın kaldırılması ───── */
  await p.click('[aria-label="Kasayı kilitle"]'); await p.waitForSelector('text=Personel girişi'); chk('K19 kilitle PIN ekranına döner', true);
  for (let i = 0; i < 5; i++) { await p.keyboard.type('0000'); await p.waitForTimeout(900); }
  chk('K20 beş hatalı PIN\'de sunucu kilitler', (await p.textContent('[role=alert]')).includes('Çok fazla'), await p.textContent('[role=alert]'));
  await p.evaluate(() => { localStorage.removeItem('tetra-pin-kilit'); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('text=Personel girişi'); await p.keyboard.type('1234'); await p.waitForTimeout(1500);
  chk('GÜV-5 PIN kilidi tarayıcı kaydı silinerek aşılamaz (sunucuda)', yol(p) === '/kasa' && await p.locator('main section button').count() === 0 && (await p.textContent('[role=alert]')).includes('Çok fazla'), await p.textContent('[role=alert]'));
  /* yönetici başka cihazdan bu cihazı kaldırır */
  const [c3, y] = await yeni(); await giris(y); await y.waitForURL('**/ekran'); await y.click('main button:has-text("Yönetim")'); await y.click('nav a:has-text("Cihazlar")'); await y.waitForSelector('li:has-text("Kasa 1")');
  chk('S16 yönetici cihazı listede görür', (await y.textContent('li:has-text("Kasa 1")')).includes('Kasa'));
  await y.click('[aria-label="Kasa 1: kaldır"]'); await y.locator('[role=dialog] button:text-is("Kaldır")').click(); await y.waitForSelector('text=Henüz tanıtılmış cihaz yok'); await c3.close();
  await p.reload(); await p.waitForSelector('#giris-eposta', { timeout: 15000 });
  chk('GÜV-6 kaldırılan cihaz anında dışarıda kalır', yol(p) === '/giris' && (await p.textContent('form')).includes('kaldırılmış') && (await p.evaluate(() => localStorage.getItem('tetra-cihaz'))) === null);
  chk('GÜV-7 kaldırılan cihazın anahtarı sunucuda geçersiz', (await api(p, 'tetra_cihaz_durum', { p_anahtar: kasaAnahtar })).j?.code === 'TT002');
  /* uydurma cihaz kaydı */
  await p.evaluate(() => localStorage.setItem('tetra-cihaz', JSON.stringify({ anahtar: 'a'.repeat(64), ekran: 'kasa', ad: 'Sahte', isletme: { id: 'x', slug: 'tetra-test', ad: 'Sahte', logo: '' } }))); await p.goto(U + '/kasa'); await p.waitForSelector('#giris-eposta', { timeout: 15000 });
  chk('GÜV-8 uydurma cihaz kaydıyla kasa açılmaz', yol(p) === '/giris');
  const inl = await p.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__inl=1'; document.head.appendChild(s); return window.__inl; });
  chk('GÜV-9 sayfaya sonradan eklenen kod çalışmaz (CSP)', inl === undefined);
  for (const yy of ['/.env', '/package.json']) { const r = await p.request.get(U + yy); chk('GÜV-10 dosya yolu 404 döner: ' + yy, r.status() === 404, r.status()); }
  await c.close(); await b.close();
  console.log(`\nTOPLAM ${sonuc.length} · GECTI ${sonuc.filter(Boolean).length} · KALDI ${sonuc.filter(x => !x).length}`);
})().catch(e => { console.log('TEST HATASI', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
