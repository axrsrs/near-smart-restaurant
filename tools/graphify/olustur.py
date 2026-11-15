#!/usr/bin/env python3
"""Tetra bağlantı haritası üreticisi.

Kaynak koddan harita çıkarır ve iki dosya yazar:
  tools/graphify/graph.json  (düğümler + bağlantılar)
  tools/graphify/graph.html  (etkileşimli görüntüleyici; veri içine gömülü, internetsiz açılır)

Çıkarılanlar:
  - Sayfalar (src/pages), rotaları (src/App.tsx), bileşenler (src/components), kütüphaneler (src/lib) ve aralarındaki import'lar
  - Arayüzün çağırdığı sunucu işlevleri (cagir / cihazCagir / sunucu.rpc / functions.invoke / .from)
  - sunucu/*.sql: işlevlerin hangi tabloları okuduğu/yazdığı, hangi iç işlevleri çağırdığı (aynı işlevin son tanımı geçerli)
  - Edge fonksiyonları (supabase/functions), Cloudflare Worker (scripts/worker-paketle.mjs) ve dış servisler
Açıklamalar dosyaların ve işlevlerin başındaki Türkçe yorumlardan alınır.

Kullanım (depo kökünde):  python3 tools/graphify/olustur.py
"""
import json
import re
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / 'tools' / 'graphify'

TURLER = [
    {'id': 'page', 'name': 'Sayfa', 'color': '#d4af37'},
    {'id': 'comp', 'name': 'Bileşen', 'color': '#e8c97a'},
    {'id': 'js', 'name': 'Kütüphane', 'color': '#5ab0ff'},
    {'id': 'rpc', 'name': 'Sunucu işlevi', 'color': '#3fc1c9'},
    {'id': 'fn', 'name': 'İç işlev', 'color': '#7d8aa8'},
    {'id': 'data', 'name': 'Tablo', 'color': '#5fcf8f'},
    {'id': 'edge', 'name': 'Edge / Worker', 'color': '#b58cff'},
    {'id': 'ext', 'name': 'Dış servis', 'color': '#e0655a'},
    {'id': 'tool', 'name': 'Göç / SQL', 'color': '#ff9f43'},
]
HUB_SAYFALAR = {'Kasa', 'Mutfak', 'Tv', 'Yonetim', 'Takip'}
# başında açıklama yorumu olmayan dosyalar için (dosyaya yorum eklenirse o kullanılır)
EK_ACIKLAMA = {
    'pages/Kasa.tsx': 'Kasa ekranı: menüden sepet, not, burada/paket, ödeme (nakit/kart), indirim/ikram, sipariş fişi ve mutfak fişi, tükendi işaretleme, bugünkü siparişler, mali fiş işareti, gün sonu.',
    'pages/Giris.tsx': 'İşletme sahibi girişi: NearMenu hesabının e-posta ve şifresiyle (tetra-giris edge fonksiyonu üzerinden; hatalı denemede kilit).',
    'pages/EkranSecimi.tsx': 'Bu cihaz hangi ekran olacak: Kasa, Mutfak, TV ya da Yönetim. Kasa/mutfak/TV seçilince cihaz o ekrana kilitlenir ve yönetici oturumu kapanır.',
    'pages/Yonetim.tsx': 'Yönetim kabuğu: Personel, Cihazlar, Menü, Raporlar ve İşletme sekmeleri.',
    'pages/yonetim/Personel.tsx': 'Personel: ad, girebileceği ekranlar, 4 haneli PIN, giriş açık/kapalı, indirim ve ikram yetkisi.',
    'App.tsx': 'Uygulamanın yönlendirmesi: rotalar, yönetici ve cihaz koşulları (giriş gerekli mi, PIN gerekli mi).',
    'main.tsx': 'Uygulamanın giriş noktası: React kökünü ve stilleri yükler.',
    'components/Ikon.tsx': 'Uygulamadaki çizgi simgeler (tek SVG seti).',
    'components/Onay.tsx': 'Silme gibi geri alınamaz işlemler için onay penceresi.',
    'components/TemaDugmesi.tsx': 'Açık/koyu tema düğmesi (her cihaz kendi seçimini saklar).',
    'lib/etiketler.ts': 'Ortak etiketler: sipariş türü ve ödeme adları, müşteri takip adresi.',
    'lib/secili.ts': 'Yönetimde seçili işletmeyi verir.',
    'lib/tema.ts': 'Açık/koyu tema seçimi ve saklanması.',
    'lib/useListe.ts': 'Sunucudan liste okuyup yenileyen ortak React kancası.',
}

dugumler: dict[str, dict] = {}
baglar: set[tuple[str, str, str]] = set()


def dugum(id_, label, tur, desc='', file=None, kind=None):
    d = dugumler.get(id_)
    if d is None:
        d = dugumler[id_] = {'id': id_, 'label': label, 'type': tur, 'desc': desc}
        if file:
            d['file'] = file
        if kind:
            d['kind'] = kind
    else:
        if desc and not d.get('desc'):
            d['desc'] = desc
        if file and not d.get('file'):
            d['file'] = file
    return d


def bag(a, b, rel):
    if a != b and a in dugumler and b in dugumler:
        baglar.add((a, b, rel))


def sade(t: str, sinir=420) -> str:
    t = re.sub(r'\s+', ' ', t).strip()
    return t if len(t) <= sinir else t[: sinir - 1].rstrip() + '…'


def yorum_bloklari(metin: str) -> list[str]:
    bloklar = []
    for m in re.finditer(r'/\*\*?(.*?)\*/', metin, re.S):
        icerik = re.sub(r'^\s*\*\s?', '', m.group(1), flags=re.M)
        bloklar.append(sade(icerik))
    return bloklar


def dosya_aciklamasi(metin: str) -> str:
    """Dosyanın en başındaki yorum ya da varsayılan dışa aktarımın hemen üstündeki yorum."""
    bas = metin.lstrip()
    if bas.startswith('/*'):
        b = yorum_bloklari(bas[: bas.find('*/') + 2])
        if b and b[0]:
            return b[0]
    m = re.search(r'(/\*\*?(?:(?!\*/).)*\*/)\s*export default', metin, re.S)
    if m:
        b = yorum_bloklari(m.group(1))
        if b:
            return b[0]
    satirlar = []
    for s in metin.splitlines():
        s = s.strip()
        if s.startswith('//'):
            satirlar.append(s.lstrip('/ ').strip())
        elif satirlar or s:
            break
    return sade(' '.join(satirlar))


# ───────── 1) sunucu/*.sql: işlevler ve tablolar ─────────
ISLEV = re.compile(r'create\s+(?:or\s+replace\s+)?function\s+(public|private)\.(\w+)\s*\(', re.I)
TABLO_REF = re.compile(r'\b(private\.tetra_\w+|public\.(?:products|categories|restaurants|members|super_admins))\b')
CAGRI_REF = re.compile(r'\b(private|public)\.(\w+)\s*\(')
YAZMA = re.compile(r'\b(insert\s+into|update|delete\s+from)\s+(private\.tetra_\w+|public\.\w+)', re.I)
TABLO_TANIM = re.compile(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(private\.tetra_\w+)', re.I)

islevler: dict[str, dict] = {}   # ad -> {'sema','govde','desc','dosya'}
tablolar: dict[str, dict] = {}
sql_dosyalari = sorted((KOK / 'sunucu').glob('*.sql'))
for f in sql_dosyalari:
    metin = f.read_text(encoding='utf-8')
    satirlar = metin.splitlines()
    ust = []
    for s in satirlar:
        if s.startswith('--'):
            ust.append(s.lstrip('- ').strip())
        elif s.strip():
            break
    dugum('sql:' + f.stem, f.name, 'tool', sade(' '.join(l for l in ust if not l.upper().startswith('UYGULAMA'))), 'sunucu/' + f.name)
    for m in TABLO_TANIM.finditer(metin):
        t = m.group(1)
        tablolar.setdefault(t, {'dosya': f.name})
    for m in ISLEV.finditer(metin):
        sema, ad = m.group(1), m.group(2)
        # gövde: ilk $$ ile kapanan $$ arası
        a = metin.find('$$', m.end())
        b = metin.find('$$', a + 2) if a >= 0 else -1
        govde = metin[a + 2:b] if a >= 0 and b > a else ''
        # işlevin hemen üstündeki -- yorum satırları
        once = metin[: m.start()].rstrip().splitlines()
        yorum = []
        for s in reversed(once):
            s2 = s.strip()
            if s2.startswith('--') and not s2.startswith('-- ─'):
                yorum.insert(0, s2.lstrip('- ').strip())
            elif s2.startswith('-- ─'):
                continue
            else:
                break
        eski = islevler.get(ad)
        islevler[ad] = {'sema': sema, 'govde': govde, 'desc': sade(' '.join(yorum)) or (eski or {}).get('desc', ''), 'dosya': f.name,
                        'dosyalar': ((eski or {}).get('dosyalar', []) + [f.name])}

for t, bilgi in tablolar.items():
    dugum('tbl:' + t, t.split('.', 1)[1], 'data', f'Tetra tablosu ({t}); ilk tanım: {bilgi["dosya"]}. API\'den doğrudan erişilemez, yalnızca sunucu işlevleriyle okunur/yazılır.')
for t, d in {'public.products': 'NearMenu ürünleri (ad, fiyat, tükendi). Tetra kasada okur, tükendi işaretini yazar.',
             'public.categories': 'NearMenu kategorileri.', 'public.restaurants': 'NearMenu işletmeleri (ad, logo, abonelik).',
             'public.members': 'NearMenu işletme üyelikleri (sahiplik denetimi).', 'public.super_admins': 'Süper yöneticiler (paket aç/kapat).'}.items():
    dugum('tbl:' + t, t.split('.', 1)[1] + ' (NearMenu)', 'data', d)

for ad, bilgi in islevler.items():
    tur = 'rpc' if bilgi['sema'] == 'public' else 'fn'
    ek = f' Tanım: {", ".join(dict.fromkeys(bilgi["dosyalar"]))}.'
    dugum('fn:' + ad, ad, tur, (bilgi['desc'] + ek).strip(), 'sunucu/' + bilgi['dosya'])
    bag('sql:' + Path(bilgi['dosya']).stem, 'fn:' + ad, 'tanımlar')
for ad, bilgi in islevler.items():
    govde = bilgi['govde']
    yazilan = {m.group(2) for m in YAZMA.finditer(govde)}
    for t in set(TABLO_REF.findall(govde)):
        if 'tbl:' + t in dugumler:
            bag('fn:' + ad, 'tbl:' + t, 'yazar' if t in yazilan else 'okur')
    for sema, cagrilan in CAGRI_REF.findall(govde):
        if cagrilan != ad and cagrilan in islevler:
            bag('fn:' + ad, 'fn:' + cagrilan, 'çağırır')
    if 'realtime.send' in govde:
        dugum('ext:realtime', 'Supabase Realtime', 'ext', 'Canlı yayın kanalı (tetra:<kanal>). Sunucu yalnızca "şu değişti" haberi yollar; içinde veri yoktur.')
        bag('fn:' + ad, 'ext:realtime', 'yayınlar')

# ───────── 2) arayüz: sayfalar, bileşenler, kütüphaneler ─────────
SRC = KOK / 'src'
kaynaklar = sorted([p for p in SRC.rglob('*') if p.suffix in ('.ts', '.tsx') and not p.name.endswith('.d.ts')])


def kimlik(p: Path) -> str:
    return 'src:' + p.relative_to(SRC).with_suffix('').as_posix()


uygulama = SRC / 'App.tsx'
app_metin = uygulama.read_text(encoding='utf-8')
bilesen_dosya = {m.group(1): m.group(2) for m in re.finditer(r"import\s+(\w+)\s+from\s+'\./([^']+)'", app_metin)}
rotalar: dict[str, list[str]] = {}
for m in re.finditer(r'<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*/?>', app_metin, re.S):
    yol, eleman = m.group(1), m.group(2)
    for ad in re.findall(r'<(\w+)', eleman):
        if ad in bilesen_dosya:
            rotalar.setdefault(bilesen_dosya[ad], []).append(yol)

for p in kaynaklar:
    rel = p.relative_to(SRC).as_posix()
    metin = p.read_text(encoding='utf-8')
    ad = p.stem
    if rel.startswith('pages/'):
        tur = 'page'
        anahtar = rel[:-len(p.suffix)]
        yol = rotalar.get(anahtar, [])
        if rel.startswith('pages/yonetim/'):
            yol = ['/yonetim/' + y.lstrip('/') for y in yol]
        label = ad + (f' ({yol[0]})' if yol else (' (Yönetim bölümü)' if rel.startswith('pages/yonetim/') else ''))
        kind = 'hub' if ad in HUB_SAYFALAR else None
    elif rel.startswith('components/'):
        tur, label, kind = 'comp', ad, None
    elif rel == 'App.tsx':
        tur, label, kind = 'page', 'Uygulama (yönlendirme)', 'hub'
    elif rel == 'main.tsx':
        tur, label, kind = 'js', 'Giriş noktası', None
    else:
        tur, label, kind = 'js', ad, None
    dugum(kimlik(p), label, tur, dosya_aciklamasi(metin) or EK_ACIKLAMA.get(rel, ''), 'src/' + rel, kind)

for p in kaynaklar:
    metin = p.read_text(encoding='utf-8')
    k = kimlik(p)
    for m in re.finditer(r"from\s+'(\.{1,2}/[^']+)'", metin):
        hedef = (p.parent / m.group(1)).resolve()
        if hedef.is_file() and hedef.suffix in ('.ts', '.tsx'):
            bag(k, kimlik(hedef), 'kullanır')
            continue
        for uz in ('.tsx', '.ts', '/index.tsx', '/index.ts'):
            aday = Path(str(hedef) + uz)
            if aday.exists():
                bag(k, kimlik(aday), 'kullanır')
                break
    for m in re.finditer(r"(?:cagir|cihazCagir)\s*(?:<[^>()]*(?:\([^)]*\)[^>()]*)*>)?\s*\(\s*'(\w+)'", metin):
        ad = m.group(1)
        if 'fn:' + ad not in dugumler:
            dugum('fn:' + ad, ad, 'rpc', 'NearMenu sunucu işlevi (Tetra deposunda tanımlı değil).' if not ad.startswith('tetra_') else 'Sunucu işlevi (canlı veritabanında; bu depodaki SQL dosyalarında tanımı yok).')
        bag(k, 'fn:' + ad, 'çağırır')
    for m in re.finditer(r"\.rpc\(\s*'(\w+)'", metin):
        ad = m.group(1)
        if 'fn:' + ad not in dugumler:
            dugum('fn:' + ad, ad, 'rpc', 'Sunucu işlevi.')
        bag(k, 'fn:' + ad, 'çağırır')
    for m in re.finditer(r"\.from\(\s*'(\w+)'\s*\)", metin):
        t = 'public.' + m.group(1)
        dugum('tbl:' + t, m.group(1) + ' (NearMenu)', 'data', 'NearMenu tablosu; satır güvenliğiyle (RLS) doğrudan yazılır.')
        bag(k, 'tbl:' + t, 'yazar' if re.search(r"\.from\(\s*'" + m.group(1) + r"'\s*\)\s*\.(insert|update|delete|upsert)", metin) else 'okur')
    for m in re.finditer(r"functions\.invoke(?:<[^>]*>)?\(\s*'([\w-]+)'", metin):
        bag(k, 'edge:' + m.group(1), 'çağırır') if ('edge:' + m.group(1)) in dugumler else None
    if re.search(r'\bsunucu\.auth\.', metin) or 'signInWithPassword' in metin:
        dugum('ext:auth', 'Supabase Auth', 'ext', 'İşletme sahibi girişi (NearMenu hesabı). Tetra, girişi tetra-giris edge fonksiyonu üzerinden yapar; oturum tarayıcıda tutulur.')
        bag(k, 'ext:auth', 'kullanır')
    if re.search(r'\.channel\(', metin):
        dugum('ext:realtime', 'Supabase Realtime', 'ext', 'Canlı yayın kanalı.')
        bag(k, 'ext:realtime', 'dinler')
    if 'challenges.cloudflare.com' in metin:
        dugum('ext:turnstile', 'Cloudflare Turnstile', 'ext', 'Giriş güvenlik doğrulaması (CAPTCHA). Site anahtarı boşken kapalıdır.')
        bag(k, 'ext:turnstile', 'yükler')
    if "'/ceviri'" in metin:
        bag(k, 'edge:worker', 'çağırır') if 'edge:worker' in dugumler else None
        dugum('ext:ceviri', 'NearMenu çeviri servisi', 'ext', 'media.neardiji.com/translate: ürün ve kategori adlarını İngilizce ve Arapçaya çevirir.')
    if 'pushManager' in metin:
        dugum('ext:push', 'Web Push', 'ext', 'Tarayıcı bildirimleri: müşterinin telefonuna "siparişiniz hazır" bildirimi.')
        bag(k, 'ext:push', 'abone olur')

# ───────── 3) edge fonksiyonları ve Worker ─────────
for d in sorted((KOK / 'supabase' / 'functions').glob('*/index.ts')):
    ad = d.parent.name
    metin = d.read_text(encoding='utf-8')
    ust = ' '.join(s.lstrip('/ ').strip() for s in metin.splitlines()[:6] if s.startswith('//'))
    dugum('edge:' + ad, ad, 'edge', sade(ust), f'supabase/functions/{ad}/index.ts')
    for m in re.finditer(r"\.rpc\(\s*'(\w+)'", metin):
        if 'fn:' + m.group(1) in dugumler:
            bag('edge:' + ad, 'fn:' + m.group(1), 'çağırır')
    if 'signInWithPassword' in metin:
        dugum('ext:auth', 'Supabase Auth', 'ext', '')
        bag('edge:' + ad, 'ext:auth', 'kullanır')
    if 'web-push' in metin:
        dugum('ext:push', 'Web Push', 'ext', '')
        bag('edge:' + ad, 'ext:push', 'gönderir')
# arayüzden edge çağrılarını ikinci geçişte bağla (edge düğümleri artık var)
for p in kaynaklar:
    metin = p.read_text(encoding='utf-8')
    for m in re.finditer(r"functions\.invoke(?:<[^>]*>)?\(\s*'([\w-]+)'", metin):
        bag(kimlik(p), 'edge:' + m.group(1), 'çağırır')

worker = KOK / 'scripts' / 'worker-paketle.mjs'
if worker.exists():
    dugum('edge:worker', 'Cloudflare Worker (tetra.neardiji.com)', 'edge',
          'Derlenmiş uygulamayı tek betik olarak sunar; güvenlik başlıkları (CSP, HSTS), tek sayfa yönlendirmesi ve /ceviri vekili.',
          'scripts/worker-paketle.mjs', 'hub')
    bag('edge:worker', 'src:App', 'sunar')
    if 'translate' in worker.read_text(encoding='utf-8'):
        dugum('ext:ceviri', 'NearMenu çeviri servisi', 'ext', 'media.neardiji.com/translate.')
        bag('edge:worker', 'ext:ceviri', 'iletir')
    for p in kaynaklar:
        if "'/ceviri'" in p.read_text(encoding='utf-8'):
            bag(kimlik(p), 'edge:worker', 'çağırır')

# ───────── 4) yaz ─────────
# hiçbir bağlantısı olmayan iç işlevleri ve tabloları ele (kalabalığı azaltır); sayfa/bileşen/kütüphane hep kalır
bagli = {a for a, _, _ in baglar} | {b for _, b, _ in baglar}
dugum_listesi = [d for d in dugumler.values() if d['id'] in bagli or d['type'] in ('page', 'comp', 'js', 'edge', 'tool')]
kalanlar = {d['id'] for d in dugum_listesi}
bag_listesi = [{'from': a, 'to': b, 'rel': r} for a, b, r in sorted(baglar) if a in kalanlar and b in kalanlar]
veri = {'types': TURLER, 'nodes': sorted(dugum_listesi, key=lambda d: (d['type'], d['label'].lower())), 'edges': bag_listesi}

(CIKTI / 'graph.json').write_text(json.dumps(veri, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
sablon = (CIKTI / 'sablon.html').read_text(encoding='utf-8')
html = sablon.replace('__BASLIK__', 'Tetra (near-smart-restaurant)').replace('__VERI__', json.dumps(veri, ensure_ascii=False, separators=(',', ':')))
(CIKTI / 'graph.html').write_text(html, encoding='utf-8')
sayim = {}
for d in dugum_listesi:
    sayim[d['type']] = sayim.get(d['type'], 0) + 1
print(f"graph.json + graph.html · {len(dugum_listesi)} düğüm · {len(bag_listesi)} bağlantı · " + ', '.join(f'{k}: {v}' for k, v in sorted(sayim.items())))
