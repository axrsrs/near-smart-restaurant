# Tetra

NEAR ailesinin sipariş sistemi (eski çalışma adı: NEAR Smart Restaurant). Self servis ve gel-al işletmeleri
için kasa, mutfak, TV ekranı ve müşteriye hazır bildirimi.

## Geliştirme

```bash
npm install
npm run dev
```

## Paket mimarisi

NEAR tek platformdur; işletmeye iki paketten biri açılır:

| | Menü | Menü + Sistem |
| --- | --- | --- |
| QR menü ve NearMenu paneli | ✓ | ✓ |
| Tetra: Kasa, Mutfak, TV, QR sipariş takibi (bu proje) | – | ✓ |

- Tek veritabanı (NearMenu'nün Supabase projesi), tek işletme kaydı, tek giriş.
- Tek ürün listesi: ürün, fiyat ve fotoğraf NearMenu'de girilir; kasa aynı kaydı okur (`src/lib/menu.ts`).
  Kasadan yalnızca "tükendi" işaretlenir.
- Paketi yalnızca süper panelden NEAR açar ve kapatır.
- Sisteme özel veriler (personel ve PIN, siparişler) ayrı tablolarda durur; NearMenu tabloları değişmez.

## Ekranlar

| Adres | Ekran |
| --- | --- |
| `/giris` | İşletme girişi (e-posta + şifre) |
| `/ekran` | Bu cihaz hangi ekran olacak: Kasa, Mutfak, TV ekranı, Yönetim |
| `/pin/kasa`, `/pin/mutfak` | Personel girişi (4 haneli PIN) |
| `/kasa` | Kasa: ürünler, sepet, not, Burada/Paket, Nakit/Kart, günlük sıra numarası, fiş, QR |
| `/t/<kod>` | Müşterinin QR ile açtığı sipariş takip sayfası |
| `/yonetim/personel` | Personel, ekran yetkileri, PIN |
| `/yonetim/isletme` | NearMenu bağlantısı |
| `/mutfak`, `/tv` | Sunucu bağlandıktan sonra kurulacak |

Şu an **önizleme** modunda çalışır: ürünler NearMenu'den canlı okunur; siparişler, personel ve "tükendi"
işaretleri bu cihazın tarayıcısında saklanır (`src/lib/veri.ts`); yönetici girişi yalnızca biçim olarak
denetlenir (`src/lib/oturum.ts`). Personel PIN'i gerçekten denetlenir; art arda 5 hatalı denemede
30 saniye kilitlenir. Sunucu bağlanınca yalnızca bu dosyaların içi değişir.

Hazır bildirimi (planlanan): müşteri QR'ı okutur ve bildirime izin verir; personel "Hazır"a basınca sunucu
tarayıcı bildirimi gönderir. iPhone normal sayfalara bildirim izni vermediği için orada takip sayfası
açıkken sesli ve ekranda uyarı verilir.

## Yayın

- Adres: https://tetra.neardiji.com (arama motorlarına kapalı)
- Yedek adres: https://near-smart-restaurant.ammarallsalam.workers.dev
- `npm run yayinla` → derler, `dist/` klasörünü tek Worker dosyasına paketler ve Cloudflare'e yükler.
- Tek dosyalık sürüm: `npm run build:tek` → `dist-tek/near-smart-restaurant.html`

## Tema

Renkler `src/index.css` içindeki `@theme` bloğunda tanımlıdır (Tailwind v4). Zemin NEAR mono (krem / siyah),
vurgu mavidir; vurgu rengi tarihsel nedenle `gold` adını taşır. Koyu tema aynı adları
`:root[data-theme="dark"]` altında yeniden tanımlar; seçim cihazda `sr-tema` anahtarıyla saklanır.
