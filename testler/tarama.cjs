const { chromium } = require('playwright'); const fs = require('fs');
const U = process.env.U || 'https://tetra.neardiji.com';
const axeKod = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const sorun = new Map(); const ekle = (k, v) => { if (!sorun.has(k)) sorun.set(k, new Set()); sorun.get(k).add(v); };
  const olc = async (p, ekran, w) => {
    const r = await p.evaluate(() => {
      const gorunur = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
      const kaydirmada = e => { for (let x = e.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if ((o === 'auto' || o === 'scroll') && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
      const ustte = e => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(innerWidth-1, r.left + r.width/2), r.top + r.height/2); return t && (e === t || e.contains(t) || t.contains(e)); };
      const ad = e => (e.getAttribute('aria-label') || e.textContent || e.id || e.tagName).trim().replace(/\s+/g,' ').slice(0, 30);
      const kucuk = [], tasan = [];
      for (const e of document.querySelectorAll('button, a[href], input:not([type=file]), select, [role=switch]')) {
        if (!gorunur(e) || !ustte(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.height < 40 || r.width < 40) kucuk.push(`${ad(e)} (${Math.round(r.width)}×${Math.round(r.height)})`);
        if (!kaydirmada(e) && (r.right > innerWidth + 1 || r.left < -1)) tasan.push(ad(e));
      }
      const kesik = [];
      for (const e of document.querySelectorAll('h1,h2,h3,p,b,span,label')) { if (!gorunur(e) || e.children.length) continue; const s = getComputedStyle(e); if (s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none' && e.scrollWidth > e.clientWidth + 2 && s.overflow !== 'visible') kesik.push(ad(e)); }
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, kucuk, tasan, kesik };
    });
    if (r.sw > r.iw) ekle('YATAY TAŞMA', `${ekran} @${w}px (${r.sw})`);
    r.kucuk.forEach(k => ekle('KÜÇÜK DOKUNMA ALANI', `${ekran}: ${k}`));
    r.tasan.forEach(k => ekle('EKRAN DIŞINA TAŞAN', `${ekran} @${w}: ${k}`));
    r.kesik.forEach(k => ekle('KESİLEN YAZI', `${ekran} @${w}: ${k}`));
  };
  const axe = async (p, ekran, tema) => {
    await p.evaluate(axeKod);
    const v = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa'] }).then(r => r.violations.map(x => `${x.id} [${x.impact}] ×${x.nodes.length} → ${x.nodes.slice(0,2).map(n => n.target.join(' ').slice(0,60) + (n.any[0]?.data?.contrastRatio ? ' oran ' + n.any[0].data.contrastRatio : '')).join(' ; ')}`)));
    v.forEach(x => ekle('ERİŞİLEBİLİRLİK', `${ekran}/${tema}: ${x}`));
  };
  for (const [w, h] of [[320, 640], [360, 740], [390, 800], [768, 1024], [1024, 768], [1366, 800]]) for (const tema of (w === 390 || w === 1024 ? ['light', 'dark'] : ['light'])) {
    const c = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true, bypassCSP: true, colorScheme: tema });
    const p = await c.newPage(); await p.addInitScript(() => { window.print = () => {}; });
    const bak = async (ekran, a11y = true) => { await p.waitForTimeout(350); await olc(p, ekran, w); if (a11y && (w === 390 || w === 1024)) await axe(p, ekran, tema); };
    const dlg = p.locator('[role=dialog]');
    await p.goto(U + '/giris'); await p.waitForSelector('#giris-eposta'); await bak('giriş');
    await p.fill('#giris-eposta', 'a@b.co'); await p.fill('#giris-sifre', '12345678'); await p.click('button[type=submit]'); await p.waitForURL('**/ekran'); await bak('ekran seçimi');
    await p.click('main button:has-text("Yönetim")'); await p.waitForURL('**/yonetim/personel'); await bak('personel (boş)');
    for (const [ad, pin] of [['Ayşe Yılmaz Kasa Sorumlusu Uzun Ad', '1234'], ['Mehmet', '5678']]) { await p.click('button:has-text("Personel ekle")'); await p.fill('#personel-ad', ad); await p.fill('#personel-pin', pin); if (ad === 'Mehmet') { await bak('personel formu'); await dlg.locator('button[aria-pressed]:has-text("Mutfak")').click(); } await dlg.locator('button[type=submit]').click(); await p.waitForTimeout(300); }
    await bak('personel (dolu)');
    await p.click('ul li [title="Sil"]'); await bak('silme onayı'); await p.keyboard.press('Escape');
    await p.click('nav a:has-text("NearMenu")'); await p.waitForTimeout(2500); await bak('nearmenu bağlantısı');
    await p.goto(U + '/pin/kasa'); await p.waitForSelector('text=Personel girişi'); await bak('PIN');
    await p.keyboard.type('1234'); await p.waitForSelector('main section button'); await p.waitForTimeout(1200); await bak('kasa');
    const acik = p.locator('main section button:not([disabled])'); for (const i of [0, 1, 2, 7, 12]) await acik.nth(i).click();
    const mobil = w < 1024; if (mobil) { await p.click('button:has-text("Sepet ·")'); } await bak(mobil ? 'sepet (telefon)' : 'kasa + sepet');
    await (mobil ? dlg : p.locator('aside')).locator('li button:has-text("Not ekle")').first().click(); await bak('not penceresi'); await dlg.locator('button:has-text("Soğansız")').click(); await dlg.locator('button:has-text("Kaydet")').click(); await p.waitForTimeout(250);
    await (mobil ? dlg : p.locator('aside')).locator('button:has-text("Siparişi tamamla")').click(); await bak('ödeme');
    await dlg.locator('button:has-text("Kart")').click(); await bak('sipariş alındı');
    const kod = await p.evaluate(() => JSON.parse(localStorage.getItem('sr-veri')).siparisler[0].kod);
    await dlg.locator('button:has-text("Yeni sipariş")').click(); await p.click('[aria-label^="Bugünkü siparişler"]'); await bak('bugünkü siparişler'); await p.keyboard.press('Escape');
    await p.click('[aria-label="Tükendi işaretleme modu"]'); await bak('tükendi modu', false);
    await p.goto(U + '/t/' + kod); await p.waitForTimeout(900); await bak('takip');
    await p.goto(U + '/mutfak'); await p.waitForTimeout(600); await bak('mutfak PIN', false);
    await c.close();
  }
  for (const [k, v] of sorun) { console.log(`\n== ${k} (${v.size})`); [...v].slice(0, 40).forEach(x => console.log('  ' + x)); }
  if (!sorun.size) console.log('SORUN YOK');
  /* hız */
  const c = await b.newContext({ viewport: { width: 390, height: 800 }, ignoreHTTPSErrors: true }); const p = await c.newPage();
  let bayt = 0, istek = 0; p.on('response', async r => { try { const u = r.url(); if (u.startsWith(U)) { istek++; bayt += Number(r.headers()['content-length'] || (await r.body()).length); } } catch {} });
  const t0 = Date.now(); await p.goto(U + '/giris', { waitUntil: 'load' }); await p.waitForSelector('#giris-eposta'); const t = Date.now() - t0; await p.waitForTimeout(800);
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null, aktarilan: performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), n.transferSize || 0) }; });
  console.log('\n== HIZ (giriş ekranı)', JSON.stringify(nav), 'istek', istek, 'giriş alanı görünme ms', t);
  await b.close();
})().catch(e => { console.log('TARAMA HATASI', e.message.split('\n').slice(0,3).join(' ')); process.exit(1); });
