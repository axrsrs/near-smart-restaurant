import { randomUUID } from 'node:crypto'
/* Sunucu işlevlerinin testi. Gerekli ortam değişkenleri: TETRA_TEST_EPOSTA, TETRA_TEST_SIFRE (deneme işletmesinin sahibi). */
const env = process.env
if (!env.TETRA_TEST_EPOSTA || !env.TETRA_TEST_SIFRE) { console.log('TETRA_TEST_EPOSTA ve TETRA_TEST_SIFRE gerekli'); process.exit(2) }
const B = 'https://rfwgjzkewtjpdcvrhepg.supabase.co', K = 'sb_publishable_ohHiomyazD8qr_mQXX9G-Q_DCEeD8j2'
let jwt = null, gecti = 0, kaldi = 0
const chk = (ad, ok, d = '') => { if (ok) gecti++; else kaldi++; console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (d !== '' ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 170) : '')) }
const rpc = async (ad, govde, yetki = jwt) => { const r = await fetch(`${B}/rest/v1/rpc/${ad}`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json', ...(yetki ? { Authorization: 'Bearer ' + yetki } : {}) }, body: JSON.stringify(govde) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
const anon = (ad, g) => rpc(ad, g, null)

// giriş
let r = await fetch(`${B}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.TETRA_TEST_EPOSTA, password: env.TETRA_TEST_SIFRE }) })
let j = await r.json(); jwt = j.access_token
chk('A01 deneme hesabı giriş yapar', r.status === 200 && !!jwt, r.status)
r = await rpc('tetra_baslangic', {}); const isl = r.j?.find(x => x.slug === 'tetra-test'); const RID = isl?.id
chk('A02 başlangıç yalnızca kendi işletmesini, Tetra açık olarak döner', r.j?.length === 1 && isl?.tetra === true && isl?.rol === 'owner', r.j)
chk('A03 girişsiz başlangıç reddedilir', (await anon('tetra_baslangic', {})).s >= 400)
const demo = '475caadf-b610-4141-b85a-43dba3d913b1'
r = await rpc('tetra_personel_liste', { p_restaurant: demo }); chk('A04 başka işletmenin personeli okunamaz', r.s >= 400, r.j?.message)
r = await rpc('tetra_cihaz_ekle', { p_restaurant: demo, p_ekran: 'kasa', p_ad: 'Sızma' }); chk('A05 başka işletmeye cihaz tanıtılamaz', r.s >= 400, r.j?.message)
r = await rpc('tetra_admin_ayarla', { p_restaurant: demo, p_aktif: true }); chk('A06 sahip paket açamaz (yalnız süper)', r.s >= 400, r.j?.message)
r = await anon('tetra_personel_liste', { p_restaurant: RID }); chk('A07 girişsiz personel listesi reddedilir', r.s >= 400, r.s)

// personel
const pk = (o) => rpc('tetra_personel_kaydet', { p_restaurant: RID, p_id: null, p_ad: 'Ayşe', p_yetkiler: ['kasa'], p_pin: '1234', p_aktif: true, ...o })
chk('P01 kısa ad reddedilir', (await pk({ p_ad: 'A' })).j?.tamam === false)
chk('P02 bozuk PIN reddedilir', (await pk({ p_pin: '12a4' })).j?.tamam === false)
chk('P03 yetkisiz personel reddedilir', (await pk({ p_yetkiler: ['yonetici'] })).j?.tamam === false)
chk('P04 personel eklenir', (await pk({})).j?.tamam === true)
r = await pk({ p_ad: 'AYŞE', p_pin: '9999' }); chk('P05 aynı ad reddedilir', r.j?.tamam === false, r.j?.hata)
r = await pk({ p_ad: 'Mehmet', p_yetkiler: ['mutfak'] }); chk('P06 aynı PIN reddedilir', r.j?.tamam === false && /PIN/.test(r.j?.hata), r.j?.hata)
chk('P07 mutfak personeli eklenir', (await pk({ p_ad: 'Mehmet', p_yetkiler: ['mutfak'], p_pin: '5678' })).j?.tamam === true)
chk('P08 kapalı personel eklenir', (await pk({ p_ad: 'Kapalı', p_pin: '4321', p_aktif: false })).j?.tamam === true)
r = await rpc('tetra_personel_liste', { p_restaurant: RID }); const AYSE = r.j?.find(x => x.ad === 'Ayşe')?.id
chk('P09 liste 3 kişi döner, PIN ya da özeti içermez', r.j?.length === 3 && !JSON.stringify(r.j).includes('pin'), r.j?.map(x => x.ad))

// cihaz
r = await rpc('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'kasa', p_ad: 'Kasa 1' }); const KASA = r.j?.anahtar
chk('C01 kasa cihazı tanıtılır, 64 haneli anahtar döner', r.j?.tamam && /^[0-9a-f]{64}$/.test(KASA))
r = await rpc('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'mutfak', p_ad: 'Mutfak' }); const MUTFAK = r.j?.anahtar
r = await rpc('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'tv', p_ad: 'TV' }); const TV = r.j?.anahtar
chk('C02 geçersiz ekran reddedilir', (await rpc('tetra_cihaz_ekle', { p_restaurant: RID, p_ekran: 'yonetim', p_ad: 'X1' })).j?.tamam === false)
r = await rpc('tetra_cihaz_liste', { p_restaurant: RID }); chk('C03 cihaz listesi anahtar içermez', r.j?.length === 3 && !JSON.stringify(r.j).includes('anahtar'), r.j?.map(x => x.ad))
r = await anon('tetra_cihaz_durum', { p_anahtar: KASA }); const KANAL = r.j?.kanal
chk('C04 cihaz anahtarıyla (girişsiz) durum okunur', r.s === 200 && r.j?.isletme?.slug === 'tetra-test' && r.j?.personel === null && r.j?.personel_tanimli === true, r.j)
r = await anon('tetra_cihaz_durum', { p_anahtar: 'a'.repeat(64) }); chk('C05 uydurma anahtar reddedilir', r.s >= 400 && r.j?.code === 'TT002', r.j)
r = await anon('tetra_cihaz_durum', { p_anahtar: "x' or '1'='1" }); chk('C06 anahtara SQL sokuşturma reddedilir', r.s >= 400, r.j?.code)

// PIN
r = await anon('tetra_siparisler', { p_anahtar: KASA }); chk('N01 PIN girilmeden kasa siparişleri okunamaz', r.s >= 400 && r.j?.code === 'TT001', r.j)
r = await anon('tetra_pin', { p_anahtar: KASA, p_pin: '5678' }); chk('N02 mutfak PIN\'i kasada geçmez', r.j?.tamam === false, r.j?.hata)
r = await anon('tetra_pin', { p_anahtar: KASA, p_pin: '4321' }); chk('N03 kapalı personelin PIN\'i geçmez', r.j?.tamam === false, r.j?.hata)
r = await anon('tetra_pin', { p_anahtar: TV, p_pin: '1234' }); chk('N04 TV PIN kabul etmez', r.j?.tamam === false, r.j?.hata)
for (let i = 0; i < 3; i++) r = await anon('tetra_pin', { p_anahtar: KASA, p_pin: '0000' })
chk('N05 beşinci hatada sunucu kilitler', r.j?.tamam === false && r.j?.kilit > 0, r.j)
r = await anon('tetra_pin', { p_anahtar: KASA, p_pin: '1234' }); chk('N06 kilitliyken doğru PIN de geçmez (sunucu denetimi)', r.j?.tamam === false && r.j?.kilit > 0, r.j?.hata)
r = await anon('tetra_pin', { p_anahtar: MUTFAK, p_pin: '5678' }); const MOTURUM = r.j?.oturum
chk('N07 kilit cihaza özeldir: mutfak cihazı etkilenmez', r.j?.tamam === true && !!MOTURUM)
console.log('… kilit süresi bekleniyor (31 sn)'); await new Promise(z => setTimeout(z, 31000))
r = await anon('tetra_pin', { p_anahtar: KASA, p_pin: '1234' }); const OTURUM = r.j?.oturum
chk('N08 süre dolunca doğru PIN oturum açar', r.j?.tamam === true && r.j?.personel?.ad === 'Ayşe' && /^[0-9a-f]{64}$/.test(OTURUM), r.j?.hata)

// sipariş
const menu = (await anon('get_menu', { p_slug: 'tetra-test' })).j; const urunler = menu.categories.flatMap(c => c.items)
const u1 = urunler.find(u => !u.sold), u2 = urunler.filter(u => !u.sold)[5], tukenmis = urunler.find(u => u.sold)
const so = (o = {}, an = KASA, ot = OTURUM) => anon('tetra_siparis_olustur', { p_anahtar: an, p_oturum: ot, p_kalemler: [{ urun_id: u1.id, adet: 2, not: 'Soğansız' }, { urun_id: u2.id, adet: 1 }], p_tur: 'paket', p_odeme: 'kart', p_istek: randomUUID(), ...o })
r = await so({}, KASA, 'f'.repeat(64)); chk('S01 uydurma oturumla sipariş reddedilir', r.s >= 400 && r.j?.code === 'TT001', r.j?.message)
r = await so({}, MUTFAK, MOTURUM); chk('S02 mutfak cihazı sipariş alamaz', r.s >= 400, r.j?.message)
r = await so({ p_kalemler: [] }); chk('S03 boş sepet reddedilir', r.j?.tamam === false, r.j?.hata)
r = await so({ p_kalemler: [{ urun_id: u1.id, adet: 0 }] }); chk('S04 sıfır adet reddedilir', r.j?.tamam === false, r.j?.hata)
r = await so({ p_kalemler: [{ urun_id: u1.id, adet: 100 }] }); chk('S05 99 üstü adet reddedilir', r.j?.tamam === false, r.j?.hata)
r = await so({ p_kalemler: [{ urun_id: randomUUID(), adet: 1 }] }); chk('S06 menüde olmayan ürün reddedilir', r.j?.tamam === false, r.j?.hata)
const demoUrun = (await anon('get_menu', { p_slug: 'nearmenu-demo' })).j.categories[0].items[1]
r = await so({ p_kalemler: [{ urun_id: demoUrun.id, adet: 1 }] }); chk('S07 başka işletmenin ürünü sipariş edilemez', r.j?.tamam === false, r.j?.hata)
if (tukenmis) { r = await so({ p_kalemler: [{ urun_id: tukenmis.id, adet: 1 }] }); chk('S08 tükenmiş ürün sipariş edilemez', r.j?.tamam === false, r.j?.hata) }
r = await so({ p_tur: 'masa' }); chk('S09 geçersiz tür reddedilir', r.j?.tamam === false, r.j?.hata)
const istek = randomUUID()
r = await so({ p_istek: istek, p_kalemler: [{ urun_id: u1.id, adet: 2, not: 'Soğansız', fiyat: 1, ad: 'Bedava' }, { urun_id: u2.id, adet: 1 }] }); const sip = r.j?.siparis
const beklenen = Math.round(u1.price * 100) * 2 + Math.round(u2.price * 100)
chk('S10 sipariş oluşur; tutarı sunucu menü fiyatından hesaplar (gönderilen fiyat yok sayılır)', r.j?.tamam && sip.toplam === beklenen && sip.kalemler[0].ad === u1.name, { toplam: sip?.toplam, beklenen })
chk('S11 takip kodu 32 haneli', /^[0-9a-f]{32}$/.test(sip?.takip_kod))
const ikiz = await Promise.all([so({ p_istek: istek }), so({ p_istek: istek })])
chk('S12 aynı istek iki kez gelince tek sipariş', ikiz.every(x => x.j?.siparis?.id === sip.id), ikiz.map(x => x.j?.siparis?.no))
const es = await Promise.all([1, 2, 3, 4, 5].map(() => so()))
const nolar = es.map(x => x.j?.siparis?.no).sort((a, b) => a - b)
chk('S13 aynı anda gelen 5 siparişin numaraları ardışık ve tekil', new Set(nolar).size === 5 && nolar[4] - nolar[0] === 4 && nolar[0] === sip.no + 1, nolar)
r = await anon('tetra_siparisler', { p_anahtar: KASA, p_oturum: OTURUM }); chk('S14 kasa bugünün siparişlerini tutarıyla görür', r.j?.siparisler?.length === 6 && r.j.siparisler[0].toplam > 0, r.j?.siparisler?.length)
r = await anon('tetra_siparisler', { p_anahtar: MUTFAK, p_oturum: MOTURUM }); chk('S15 mutfak siparişleri tutarsız (fiyatsız özet) görür', r.j?.siparisler?.length === 6 && r.j.siparisler[0].toplam === undefined && r.j.siparisler[0].takip_kod === undefined, Object.keys(r.j?.siparisler?.[0] ?? {}))
r = await anon('tetra_siparisler', { p_anahtar: TV }); chk('S16 TV yalnızca numara ve durum görür', r.j?.siparisler?.length === 6 && Object.keys(r.j.siparisler[0]).sort().join() === 'durum,hazir_zaman,no', Object.keys(r.j?.siparisler?.[0] ?? {}))

// durum
const sd = (an, ot, d, id = sip.id) => anon('tetra_siparis_durum', { p_anahtar: an, p_oturum: ot, p_id: id, p_durum: d })
r = await sd(KASA, OTURUM, 'hazir'); chk('D01 kasa "hazır" yapamaz', r.j?.tamam === false, r.j?.hata)
r = await sd(MUTFAK, MOTURUM, 'teslim'); chk('D02 hazır olmadan teslim edilemez', r.j?.tamam === false, r.j?.hata)
r = await sd(MUTFAK, MOTURUM, 'hazir'); chk('D03 mutfak "hazır" yapar', r.j?.tamam && r.j.siparis.durum === 'hazir' && !!r.j.siparis.hazir_zaman)
r = await anon('tetra_takip', { p_kod: sip.takip_kod }); chk('D04 müşteri takip kodu ile numara ve durumu görür', r.j?.no === sip.no && r.j?.durum === 'hazir' && Object.keys(r.j).sort().join() === 'durum,isletme,no,tur', r.j)
r = await anon('tetra_takip', { p_kod: 'f'.repeat(32) }); chk('D05 yanlış takip kodu boş döner', r.j === null)
r = await sd(MUTFAK, MOTURUM, 'teslim'); chk('D06 teslim edilir', r.j?.siparis?.durum === 'teslim')
r = await sd(KASA, OTURUM, 'iptal'); chk('D07 teslim edilen iptal edilemez', r.j?.tamam === false, r.j?.hata)
r = await sd(KASA, OTURUM, 'iptal', es[0].j.siparis.id); chk('D08 kasa bekleyen siparişi iptal eder', r.j?.siparis?.durum === 'iptal')
r = await sd(KASA, OTURUM, 'iptal', randomUUID()); chk('D09 olmayan sipariş', r.j?.tamam === false)

// tükendi
r = await anon('tetra_tukendi', { p_anahtar: MUTFAK, p_oturum: MOTURUM, p_urun: u2.id, p_tukendi: true }); chk('T01 mutfak tükendi işaretleyemez', r.s >= 400)
r = await anon('tetra_tukendi', { p_anahtar: KASA, p_oturum: OTURUM, p_urun: demoUrun.id, p_tukendi: true }); chk('T02 başka işletmenin ürünü işaretlenemez', r.j?.tamam === false, r.j?.hata)
const v0 = (await anon('menu_version', { p_slug: 'tetra-test' })).j
r = await anon('tetra_tukendi', { p_anahtar: KASA, p_oturum: OTURUM, p_urun: u2.id, p_tukendi: true })
const sonra = (await anon('get_menu', { p_slug: 'tetra-test' })).j.categories.flatMap(c => c.items).find(u => u.id === u2.id)
chk('T03 kasadan tükendi → NearMenu menüsünde de tükendi, sürüm damgası değişir', r.j?.tamam && sonra.sold === true && (await anon('menu_version', { p_slug: 'tetra-test' })).j !== v0)
const demoSonra = (await anon('get_menu', { p_slug: 'nearmenu-demo' })).j.categories.flatMap(c => c.items).find(u => u.name === u2.name)
chk('T04 demo işletmenin aynı adlı ürünü etkilenmedi', demoSonra?.sold === false)
await anon('tetra_tukendi', { p_anahtar: KASA, p_oturum: OTURUM, p_urun: u2.id, p_tukendi: false })

// oturum kapatma
r = await rpc('tetra_personel_kaydet', { p_restaurant: RID, p_id: AYSE, p_ad: 'Ayşe', p_yetkiler: ['kasa'], p_pin: '', p_aktif: false })
r = await so(); chk('O01 girişi kapatılan personelin açık oturumu anında düşer', r.s >= 400 && r.j?.code === 'TT001', r.j?.message)
await rpc('tetra_personel_kaydet', { p_restaurant: RID, p_id: AYSE, p_ad: 'Ayşe', p_yetkiler: ['kasa'], p_pin: '', p_aktif: true })
r = await anon('tetra_kilitle', { p_anahtar: MUTFAK }); r = await anon('tetra_siparisler', { p_anahtar: MUTFAK, p_oturum: MOTURUM }); chk('O02 kilitlenen cihazın oturumu geçersiz', r.s >= 400)
const liste = (await rpc('tetra_cihaz_liste', { p_restaurant: RID })).j
await rpc('tetra_cihaz_sil', { p_restaurant: RID, p_id: liste.find(c => c.ekran === 'tv').id })
r = await anon('tetra_siparisler', { p_anahtar: TV }); chk('O03 kaldırılan cihazın anahtarı çalışmaz', r.s >= 400 && r.j?.code === 'TT002', r.j?.code)

// doğrudan tablo erişimi
for (const t of ['tetra_siparis', 'tetra_personel', 'tetra_cihaz']) { const x = await fetch(`${B}/rest/v1/${t}?select=*`, { headers: { apikey: K, Authorization: 'Bearer ' + jwt } }); chk(`G01 ${t} tablosu API'den okunamaz (girişli bile)`, x.status >= 400, x.status) }
console.log(`\nTOPLAM ${gecti + kaldi} · GECTI ${gecti} · KALDI ${kaldi}`); console.log('KANAL uzunluk', KANAL?.length)
