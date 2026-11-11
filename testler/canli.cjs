/* Tetra canlı akış testi: kasa → mutfak → TV → müşteri, dört ayrı "cihaz" ile.
   Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. Kullanım: node testler/canli.cjs  (başka adres için U=...) */
const { chromium } = require('playwright');
const U = process.env.U || 'https://tetra.neardiji.com';
const EPOSTA = process.env.TETRA_TEST_EPOSTA, SIFRE = process.env.TETRA_TEST_SIFRE;
const B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2';
if (!EPOSTA || !SIFRE) { console.log('TETRA_TEST_EPOSTA ve TETRA_TEST_SIFRE gerekli'); process.exit(2); }
const sonuc = [];
const chk = (ad, ok, d = '') => { sonuc.push(ok); console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (d !== '' ? ' :: ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 170) : '')); };
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const hazirlik = await b.newContext({ ignoreHTTPSErrors: true }); const hp = await hazirlik.newPage();
  const api = async (ad, govde, jwt) => { const r = await hp.request.post(`${B}/rest/v1/rpc/${ad}`, { headers: { apikey: K, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, data: govde }); let j = null; try { j = await r.json(); } catch {} return { s: r.status(), j }; };
  const JWT = (await (await hp.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: EPOSTA, password: SIFRE } })).json()).access_token;
  const isl = (await api('tetra_baslangic', {}, JWT)).j.find(x => x.tetra); const RID = isl.id;
  for (const x of (await api('tetra_personel_liste', { p_restaurant: RID }, JWT)).j) await api('tetra_personel_sil', { p_restaurant: RID, p_id: x.id }, JWT);
  for (const x of (await api('tetra_cihaz_liste', { p_restaurant: RID }, JWT)).j) await api('tetra_cihaz_sil', { p_restaurant: RID, p_id: x.id }, JWT);
  await api('tetra_personel_kaydet', { p_restaurant: RID, p_id: null, p_ad: 'Ayşe', p_yetkiler: ['kasa'], p_pin: '1234', p_aktif: true }, JWT);
  await api('tetra_personel_kaydet', { p_restaurant: RID, p_id: null, p_ad: 'Mehmet', p_yetkiler: ['mutfak'], p_pin: '5678', p_aktif: true }, JWT);
  const cihaz = async (ekran, ad, w, h, pin) => {
    const anahtar = (await api('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: ekran, p_ad: ad }, JWT)).j.anahtar;
    const c = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true }); const p = await c.newPage(); p.__err = [];
    p.on('pageerror', e => p.__err.push(e.message));
    await p.addInitScript(([k, e, a, i]) => { window.print = () => {}; if (!localStorage.getItem('tetra-cihaz')) localStorage.setItem('tetra-cihaz', JSON.stringify({ anahtar: k, ekran: e, ad: a, isletme: i })); }, [anahtar, ekran, ad, { id: isl.id, slug: isl.slug, ad: isl.ad, logo: isl.logo }]);
    await p.goto(U + '/' + ekran);
    if (pin) { await p.waitForSelector('text=Personel girişi', { timeout: 20000 }); await p.keyboard.type(pin); }
    return p;
  };
  const kasa = await cihaz('kasa', 'Kasa 1', 1180, 820, '1234');
  const mutfak = await cihaz('mutfak', 'Mutfak', 1180, 820, '5678');
  const tv = await cihaz('tv', 'TV', 1280, 720, null);
  await kasa.waitForSelector('main section button', { timeout: 20000 });
  await mutfak.waitForSelector('section[aria-label="Hazırlanıyor"]', { timeout: 20000 });
  await tv.waitForSelector('section[aria-label="Hazır"]', { timeout: 20000 });
  chk('C01 üç cihaz kendi ekranını açtı (kasa, mutfak, TV)', true);
  await mutfak.waitForSelector('text=Canlı', { timeout: 15000 }).then(() => chk('C02 mutfak canlı bağlantı kurdu', true), () => chk('C02 mutfak canlı bağlantı kurdu', false));

  /* sipariş: kasa → mutfak ve TV */
  const acik = kasa.locator('main section button:not([disabled])'); const sep = kasa.locator('aside');
  await acik.nth(0).click(); await acik.nth(0).click(); await acik.nth(4).click();
  await sep.locator('li button:has-text("Not ekle")').first().click(); await kasa.locator('[role=dialog] button:has-text("Acısız")').click(); await kasa.locator('[role=dialog] button:has-text("Kaydet")').click();
  await sep.locator('button:has-text("Paket")').click(); await sep.locator('button:has-text("Siparişi tamamla")').click(); await kasa.locator('[role=dialog] button:has-text("Nakit")').click();
  await kasa.waitForSelector('[role=dialog] p.text-8xl', { timeout: 15000 }); const t0 = Date.now();
  const no = (await kasa.locator('[role=dialog] p.text-8xl').textContent()).trim();
  const kart = mutfak.locator(`section[aria-label="Hazırlanıyor"] li:has(span.text-5xl:text-is("${no}"))`);
  await kart.waitFor({ timeout: 8000 }).then(() => chk('C03 sipariş mutfağa canlı düştü', true, `${Date.now() - t0} ms`), () => chk('C03 sipariş mutfağa canlı düştü', false, '8 sn içinde gelmedi'));
  const kartYazi = await kart.textContent();
  chk('C04 mutfak kartında adet, ürün, not ve PAKET görünür; fiyat görünmez', /2 ×/.test(kartYazi) && kartYazi.includes('Acısız') && kartYazi.includes('PAKET') && !kartYazi.includes('₺'), kartYazi);
  const tvSol = tv.locator('section[aria-label="Hazırlanıyor"] li', { hasText: new RegExp(`^${no}$`) });
  await tvSol.waitFor({ timeout: 8000 }).then(() => chk('C05 numara TV\'de "Hazırlanıyor"da görünür', true), () => chk('C05 numara TV\'de "Hazırlanıyor"da görünür', false));
  await kasa.locator('[role=dialog] button:has-text("Yeni sipariş")').click();

  /* müşteri telefonu */
  const oturum = await kasa.evaluate(() => JSON.parse(sessionStorage.getItem('tetra-personel-oturum'))); const kasaAnahtar = await kasa.evaluate(() => JSON.parse(localStorage.getItem('tetra-cihaz')).anahtar);
  const takipKod = (await api('tetra_siparisler', { p_anahtar: kasaAnahtar, p_oturum: oturum })).j.siparisler.find(x => String(x.no) === no).takip_kod;
  const mc = await b.newContext({ viewport: { width: 390, height: 800 }, ignoreHTTPSErrors: true }); const musteri = await mc.newPage();
  await musteri.goto(U + '/t/' + takipKod); await musteri.waitForSelector('[aria-current=step]:has-text("Hazırlanıyor")', { timeout: 15000 }); chk('C06 müşteri telefonunda "Hazırlanıyor" görünür', true);

  /* mutfak: hazır */
  const t1 = Date.now(); await kart.locator('button:has-text("Hazır")').click();
  const tvSag = tv.locator('section[aria-label="Hazır"] li', { hasText: new RegExp(`^${no}$`) });
  await tvSag.waitFor({ timeout: 8000 }).then(() => chk('C07 mutfak "Hazır" deyince numara TV\'de "Hazır"a geçer', true, `${Date.now() - t1} ms`), () => chk('C07 mutfak "Hazır" deyince numara TV\'de "Hazır"a geçer', false));
  chk('C08 numara TV\'de "Hazırlanıyor"dan kalktı', await tvSol.count() === 0);
  chk('C09 mutfakta sipariş "teslim bekliyor" sütununa geçti', await mutfak.locator(`section[aria-label="Hazır, teslim bekliyor"] li:has(span:text-is("${no}"))`).count() === 1);
  await kasa.click('[aria-label^="Bugünkü siparişler"]');
  await kasa.locator(`[role=dialog] li:has(span.w-12:text-is("${no}")) span:text-is("Hazır")`).waitFor({ timeout: 8000 }).then(() => chk('C10 kasa listesinde sipariş "Hazır" görünür', true), () => chk('C10 kasa listesinde sipariş "Hazır" görünür', false));
  await kasa.keyboard.press('Escape');
  await musteri.waitForSelector('[aria-current=step]:has-text("Hazır")', { timeout: 25000 }).then(() => chk('C11 müşteri telefonunda "Hazır" görünür (15 sn içinde)', true, `${Date.now() - t1} ms`), () => chk('C11 müşteri telefonunda "Hazır" görünür', false));

  /* geri al, yeniden hazır, teslim */
  const hazirKart = mutfak.locator(`section[aria-label="Hazır, teslim bekliyor"] li:has(span:text-is("${no}"))`);
  await hazirKart.locator('button:has-text("Geri al")').click(); await tvSol.waitFor({ timeout: 8000 }).then(() => chk('C12 "Geri al" numarayı yeniden "Hazırlanıyor"a alır', true), () => chk('C12 "Geri al"', false));
  await kart.locator('button:has-text("Hazır")').click(); await tvSag.waitFor({ timeout: 8000 });
  await hazirKart.locator('button:has-text("Teslim edildi")').click();
  await tvSag.waitFor({ state: 'detached', timeout: 8000 }).then(() => chk('C13 teslim edilen numara TV\'den kalkar', true), () => chk('C13 teslim edilen numara TV\'den kalkar', false));
  chk('C14 teslim edilen sipariş mutfak ekranından kalkar', await mutfak.locator(`li:has(span:text-is("${no}"))`).count() === 0);
  await musteri.waitForSelector('[aria-current=step]:has-text("Teslim edildi")', { timeout: 25000 }).then(() => chk('C15 müşteri telefonunda "Teslim edildi" görünür', true), () => chk('C15 müşteri "Teslim edildi"', false));

  /* yetki: TV anahtarıyla ayrıntı okunamaz, mutfak iptal edemez */
  const tvAnahtar = await tv.evaluate(() => JSON.parse(localStorage.getItem('tetra-cihaz')).anahtar);
  const tvVeri = (await api('tetra_siparisler', { p_anahtar: tvAnahtar })).j;
  chk('GÜV-1 TV cihazı yalnızca numara ve durum alır (ürün, tutar, takip kodu yok)', !JSON.stringify(tvVeri).match(/kalemler|toplam|takip_kod|personel/), Object.keys(tvVeri.siparisler[0] ?? { bos: 1 }));
  chk('GÜV-2 TV anahtarıyla sipariş durumu değiştirilemez', (await api('tetra_siparis_durum', { p_anahtar: tvAnahtar, p_oturum: null, p_id: '00000000-0000-4000-8000-000000000000', p_durum: 'hazir' })).s >= 400);

  /* görünüm: taşma ve dokunma alanı */
  const olc = async (p, ad, w, h) => { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400); const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, kucuk: [...document.querySelectorAll('button, a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40); }).map(e => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)) })); chk(`G01 ${ad} @${w}px taşma yok, dokunma alanları yeterli`, r.sw <= r.iw && r.kucuk.length === 0, r); };
  await acik.nth(1).click(); await sep.locator('button:has-text("Siparişi tamamla")').click(); await kasa.locator('[role=dialog] button:has-text("Kart")').click(); await kasa.waitForSelector('[role=dialog] p.text-8xl'); await mutfak.waitForTimeout(2500);
  for (const [w, h] of [[390, 800], [768, 1024], [1280, 800]]) await olc(mutfak, 'mutfak', w, h);
  for (const [w, h] of [[390, 800], [1280, 720], [1920, 1080]]) await olc(tv, 'TV', w, h);
  chk('C16 hiçbir ekranda sayfa hatası yok', [kasa, mutfak, tv].every(p => p.__err.length === 0), [kasa, mutfak, tv].map(p => p.__err.join('|')).join(' ; '));
  await mutfak.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/mutfak-m.png' : '/dev/null' }).catch(() => {});
  if (process.env.SHOTS) { await mutfak.setViewportSize({ width: 1180, height: 820 }); await mutfak.waitForTimeout(300); await mutfak.screenshot({ path: process.env.SHOTS + '/mutfak.png' }); await tv.setViewportSize({ width: 1280, height: 720 }); await tv.waitForTimeout(300); await tv.screenshot({ path: process.env.SHOTS + '/tv.png' }); }
  await b.close();
  console.log(`\nTOPLAM ${sonuc.length} · GECTI ${sonuc.filter(Boolean).length} · KALDI ${sonuc.filter(x => !x).length}`);
})().catch(e => { console.log('TEST HATASI', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
