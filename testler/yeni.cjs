/* Tetra · anlık takip, bildirim zinciri ve rapor testi. Gerekli: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE. */
const { chromium } = require('playwright'); const crypto = require('crypto');
const U = process.env.U || 'https://tetra.neardiji.com';
const EPOSTA = process.env.TETRA_TEST_EPOSTA, SIFRE = process.env.TETRA_TEST_SIFRE;
const B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2';
if (!EPOSTA || !SIFRE) { console.log('TETRA_TEST_EPOSTA ve TETRA_TEST_SIFRE gerekli'); process.exit(2); }
const sonuc = [];
const chk = (ad, ok, d = '') => { sonuc.push(ok); console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (d !== '' ? ' :: ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 190) : '')); };
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const hc = await b.newContext({ ignoreHTTPSErrors: true }); const hp = await hc.newPage();
  const api = async (ad, govde, jwt) => { const r = await hp.request.post(`${B}/rest/v1/rpc/${ad}`, { headers: { apikey: K, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, data: govde }); let j = null; try { j = await r.json(); } catch {} return { s: r.status(), j }; };
  const JWT = (await (await hp.request.post(`${B}/auth/v1/token?grant_type=password`, { headers: { apikey: K, 'Content-Type': 'application/json' }, data: { email: EPOSTA, password: SIFRE } })).json()).access_token;
  const RID = (await api('tetra_baslangic', {}, JWT)).j.find(x => x.tetra).id;
  for (const x of (await api('tetra_personel_liste', { p_restaurant: RID }, JWT)).j) await api('tetra_personel_sil', { p_restaurant: RID, p_id: x.id }, JWT);
  for (const x of (await api('tetra_cihaz_liste', { p_restaurant: RID }, JWT)).j) await api('tetra_cihaz_sil', { p_restaurant: RID, p_id: x.id }, JWT);
  await api('tetra_personel_kaydet', { p_restaurant: RID, p_id: null, p_ad: 'Ayşe', p_yetkiler: ['kasa', 'mutfak'], p_pin: '1234', p_aktif: true }, JWT);
  const KASA = (await api('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'kasa', p_ad: 'Kasa 1' }, JWT)).j.anahtar;
  const MUTFAK = (await api('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'mutfak', p_ad: 'Mutfak' }, JWT)).j.anahtar;
  const KO = (await api('tetra_pin', { p_anahtar: KASA, p_pin: '1234' })).j.oturum, MO = (await api('tetra_pin', { p_anahtar: MUTFAK, p_pin: '1234' })).j.oturum;
  const urun = (await api('get_menu', { p_slug: 'tetra-test' })).j.categories.flatMap(c => c.items).filter(u => !u.sold);
  const siparis = async () => (await api('tetra_siparis_olustur', { p_anahtar: KASA, p_oturum: KO, p_kalemler: [{ urun_id: urun[0].id, adet: 2 }, { urun_id: urun[3].id, adet: 1 }], p_tur: 'burada', p_odeme: 'nakit', p_istek: crypto.randomUUID() })).j.siparis;
  const durum = (id, d, an = MUTFAK, ot = MO) => api('tetra_siparis_durum', { p_anahtar: an, p_oturum: ot, p_id: id, p_durum: d });

  /* ── bildirim aboneliği ── */
  const s1 = await siparis();
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const abone = { p_endpoint: 'https://fcm.googleapis.com/fcm/send/tetra-test-' + crypto.randomBytes(8).toString('hex'), p_p256dh: ecdh.getPublicKey().toString('base64url'), p_auth: crypto.randomBytes(16).toString('base64url') };
  chk('B01 yanlış takip koduyla abonelik reddedilir', (await api('tetra_takip_abone', { p_kod: 'f'.repeat(32), ...abone })).j.tamam === false);
  chk('B02 https olmayan bildirim adresi reddedilir', (await api('tetra_takip_abone', { p_kod: s1.takip_kod, ...abone, p_endpoint: 'http://kotu.example/x' })).j.tamam === false);
  chk('B03 geçerli abonelik kaydedilir', (await api('tetra_takip_abone', { p_kod: s1.takip_kod, ...abone })).j.tamam === true);
  chk('B04 abonelikleri okuyan işlev dışarıdan çağrılamaz', (await api('tetra_bildirim_al', { p_anahtar: MUTFAK, p_siparis: s1.id })).s >= 400 && (await api('tetra_bildirim_al', { p_anahtar: MUTFAK, p_siparis: s1.id }, JWT)).s >= 400);
  const fn = async (govde) => { const r = await hp.request.post(`${B}/functions/v1/tetra-bildir`, { headers: { apikey: K, 'Content-Type': 'application/json', Origin: 'https://tetra.neardiji.com' }, data: govde }); let j = null; try { j = await r.json(); } catch {} return { s: r.status(), j }; };
  let r = await fn({ anahtar: MUTFAK, siparis: s1.id }); chk('B05 hazır olmayan sipariş için bildirim gitmez', r.s === 200 && r.j.gonderilen === 0 && !r.j.basarisiz, r);
  r = await durum(s1.id, 'hazir'); chk('B06 "Hazır" yanıtı bildirim isteyen müşteri olduğunu bildirir', r.j.tamam && r.j.bildirim === true, r.j.bildirim);
  r = await fn({ anahtar: MUTFAK, siparis: s1.id });
  chk('B07 bildirim işlevi çalışıyor: anahtarlar tanımlı, abonelik bulundu ve gönderim denendi', r.s === 200 && (r.j.gonderilen + (r.j.basarisiz ?? 0)) === 1, r);
  r = await fn({ anahtar: MUTFAK, siparis: s1.id }); chk('B08 abonelik bir kez kullanılır, sonra silinir', r.s === 200 && r.j.gonderilen === 0 && !r.j.basarisiz, r);
  chk('B09 uydurma cihaz anahtarıyla bildirim işlevi reddeder', (await fn({ anahtar: 'a'.repeat(64), siparis: s1.id })).s === 403);
  chk('B10 bozuk istek reddedilir', (await fn({ anahtar: 'x', siparis: 'y' })).s === 400);
  chk('B11 hazır siparişe yeni abonelik alınmaz', (await api('tetra_takip_abone', { p_kod: s1.takip_kod, ...abone })).j.tamam === false);

  /* ── anlık takip (müşteri telefonu) ── */
  const s2 = await siparis();
  const mc = await b.newContext({ viewport: { width: 390, height: 800 }, ignoreHTTPSErrors: true, permissions: ['notifications'] }); const m = await mc.newPage(); const hatalar = []; m.on('pageerror', e => hatalar.push(e.message));
  await m.goto(U + '/t/' + s2.takip_kod); await m.waitForSelector('[aria-current=step]:has-text("Hazırlanıyor")', { timeout: 20000 });
  chk('T01 takip sayfasında "Hazır olunca haber ver" düğmesi var', await m.locator('button:has-text("Hazır olunca haber ver")').count() === 1);
  await m.waitForTimeout(4000); // canlı bağlantı kurulsun; bundan sonra düzenli sorgu 30 sn'de birdir
  const sureler = [];
  for (const [d, yazi] of [['hazir', 'Hazır'], ['hazirlaniyor', 'Hazırlanıyor'], ['hazir', 'Hazır']]) { const t = Date.now(); await durum(s2.id, d); await m.waitForSelector(`[aria-current=step]:text-is("${yazi}")`, { timeout: 12000 }).then(() => sureler.push(Date.now() - t), () => sureler.push(99999)); }
  chk('T02 durum değişikliği müşteri ekranına anında yansır (3 denemenin hepsi 3 sn altında)', sureler.every(x => x < 3000), sureler.join(' ms, ') + ' ms');
  chk('T03 hazır olunca ekranda belirgin uyarı çıkar', (await m.textContent('main')).includes('Siparişiniz hazır'));
  await durum(s2.id, 'hazirlaniyor'); await m.waitForSelector('button:has-text("Hazır olunca haber ver")', { timeout: 12000 });
  await m.click('button:has-text("Hazır olunca haber ver")'); await m.waitForSelector('main [role=status]', { timeout: 20000 });
  const haber = await m.textContent('main [role=status]');
  chk('T04 düğme izin ister ve sonucu açıkça bildirir', /Bildirim açık|sesli uyarı/.test(haber), haber);
  chk('T05 servis çalışanı yüklenebiliyor (/sw.js)', (await m.request.get(U + '/sw.js')).status() === 200);
  await durum(s2.id, 'hazir'); await durum(s2.id, 'teslim'); await m.waitForSelector('[aria-current=step]:has-text("Teslim edildi")', { timeout: 12000 });
  chk('T06 takip sayfasında hata yok, telefonda taşma yok', hatalar.length === 0 && (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, hatalar.join('|'));

  /* ── rapor ── */
  const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  r = await api('tetra_rapor', { p_restaurant: RID, p_bas: bugun, p_bit: bugun }, JWT);
  const liste = (await api('tetra_siparisler', { p_anahtar: KASA, p_oturum: KO })).j.siparisler; const gecerli = liste.filter(x => x.durum !== 'iptal');
  const ciro = gecerli.reduce((t, x) => t + x.toplam, 0);
  chk('R01 bugünün raporu kasadaki siparişlerle birebir tutuyor (sayı, ciro, iptal)', r.j?.ozet?.siparis === gecerli.length && r.j.ozet.ciro === ciro && r.j.ozet.iptal === liste.length - gecerli.length, { rapor: r.j?.ozet, kasa: { siparis: gecerli.length, ciro } });
  chk('R02 nakit + kart = ciro; burada + paket = sipariş', r.j.ozet.nakit + r.j.ozet.kart === r.j.ozet.ciro && r.j.ozet.burada + r.j.ozet.paket === r.j.ozet.siparis);
  chk('R03 ürün dökümünün toplamı ciroya eşit', r.j.urunler.length > 0 && (r.j.urunler.length === 20 || r.j.urunler.reduce((t, u) => t + u.ciro, 0) === ciro), r.j.urunler.length);
  chk('R04 girişsiz rapor okunamaz', (await api('tetra_rapor', { p_restaurant: RID, p_bas: bugun, p_bit: bugun })).s >= 400);
  chk('R05 başka işletmenin raporu okunamaz', (await api('tetra_rapor', { p_restaurant: '475caadf-b610-4141-b85a-43dba3d913b1', p_bas: bugun, p_bit: bugun }, JWT)).s >= 400);
  chk('R06 ters ve aşırı uzun tarih aralığı reddedilir', (await api('tetra_rapor', { p_restaurant: RID, p_bas: bugun, p_bit: '2020-01-01' }, JWT)).s >= 400 && (await api('tetra_rapor', { p_restaurant: RID, p_bas: '2020-01-01', p_bit: bugun }, JWT)).s >= 400);
  const yc = await b.newContext({ viewport: { width: 390, height: 800 }, ignoreHTTPSErrors: true }); const y = await yc.newPage(); const yh = []; y.on('pageerror', e => yh.push(e.message));
  await y.goto(U + '/giris'); await y.fill('#giris-eposta', EPOSTA); await y.fill('#giris-sifre', SIFRE); await y.click('button[type=submit]'); await y.waitForURL('**/ekran');
  chk('R07 Tetra içinde "Paketler" kartı yok (paket yalnız süper panelden)', await y.locator('main button:has-text("Paketler")').count() === 0);
  await y.click('main button:has-text("Yönetim")'); await y.click('nav a:has-text("Raporlar")'); await y.waitForSelector('dl dd', { timeout: 20000 });
  const ekranCiro = await y.locator('dl div').first().textContent(); const beklenen = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(ciro / 100);
  chk('R08 Raporlar ekranı ciroyu doğru gösterir', ekranCiro.includes(beklenen), `${ekranCiro} / beklenen ${beklenen}`);
  await y.click('button:has-text("Son 7 gün")'); await y.waitForTimeout(2500); chk('R09 tarih aralığı değişince rapor yenilenir, günlük döküm ve en çok satanlar görünür', (await y.textContent('body')).includes('En çok satanlar') && (await y.textContent('body')).includes('Günlük döküm'));
  await y.click('button:has-text("Özel")'); chk('R10 özel tarih alanları açılır', await y.locator('#rapor-bas').count() === 1);
  const olcum = await y.evaluate(() => ({ sw: document.documentElement.scrollWidth, kucuk: [...document.querySelectorAll('button, a[href], input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).length }));
  chk('R11 Raporlar telefonda taşmıyor, dokunma alanları yeterli, hata yok', olcum.sw <= 390 && olcum.kucuk === 0 && yh.length === 0, { ...olcum, yh });
  if (process.env.SHOTS) { await y.click('button:has-text("Bugün")'); await y.waitForTimeout(2000); await y.screenshot({ path: process.env.SHOTS + '/rapor.png', fullPage: true }); }
  await b.close();
  console.log(`\nTOPLAM ${sonuc.length} · GECTI ${sonuc.filter(Boolean).length} · KALDI ${sonuc.filter(x => !x).length}`);
})().catch(e => { console.log('TEST HATASI', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
