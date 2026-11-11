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
- Paketi yalnızca NEAR açar ve kapatır: NearMenu süper panelinde işletmeyi düzenlerken "Tetra" alanından.
- Sisteme özel veriler (personel ve PIN, siparişler) ayrı tablolarda durur; NearMenu tabloları değişmez.

## Ekranlar

| Adres | Kim | Ekran |
| --- | --- | --- |
| `/giris` | Yönetici | NearMenu hesabıyla giriş (e-posta + şifre) |
| `/ekran` | Yönetici | Bu cihazı Kasa / Mutfak / TV olarak tanıt ya da Yönetim'e geç |
| `/yonetim/personel` | Yönetici | Personel, ekran yetkileri, PIN |
| `/yonetim/cihazlar` | Yönetici | Tanıtılmış cihazlar, kaldırma |
| `/yonetim/raporlar` | Yönetici | Ciro, nakit/kart, günlük döküm, en çok satanlar |
| `/yonetim/isletme` | Yönetici | İşletme ve NearMenu bağlantısı |
| `/kasa` | Kasa cihazı | PIN, ürünler, sepet, not, Burada/Paket, Nakit/Kart, sıra numarası, fiş, QR |
| `/mutfak` | Mutfak cihazı | PIN, gelen siparişler (canlı), Hazır / Teslim edildi / Geri al, yeni siparişte ses |
| `/tv` | TV cihazı | Hazırlanan ve hazır numaralar (canlı), hazır olunca ses, tam ekran |
| `/t/<kod>` | Müşteri | QR ile açılan sipariş takip sayfası |
| `/kurulum` | Herkes | Yeni işletmeye gönderilen ilk kurulum sayfası (5 adım) |

## Kimlik ve yetki

İki ayrı kimlik vardır:

- **Yönetici:** İşletme sahibi NearMenu hesabıyla girer (Supabase Auth). Personeli ve cihazları yönetir.
- **Cihaz:** Yönetici bir tableti Kasa / Mutfak / TV olarak tanıttığında sunucu o cihaza bir anahtar verir ve
  yönetici oturumu o cihazda kapanır. Cihaz yalnızca kendi anahtarını taşır; kasiyer sahibin yetkilerine erişemez.
  Kaldırılan cihazın anahtarı anında geçersiz olur.
- **Personel:** Kasa ve mutfakta 4 haneli PIN ile oturum açar. PIN, 5 hatada kilit ve oturum sunucuda denetlenir.

Sunucu (`sunucu/001_tetra_temel.sql`): Tetra tabloları `private` şemadadır, API'den doğrudan erişilemez; her şey
yetki denetimli işlevlerden geçer. Sipariş tutarını, sıra numarasını ve tükendi denetimini sunucu yapar;
tarayıcıdan gelen fiyata güvenilmez. Aynı sipariş isteği iki kez gelirse tek sipariş oluşur.
Kasadan verilen "tükendi" işareti ürünün NearMenu kaydını günceller.

Canlı güncelleme (`src/lib/canli.ts`): sunucu, işletmenin gizli kanalına yalnızca "şu değişti" haberi yollar;
haberde veri yoktur. Haberi alan ekran güncel listeyi kendi cihaz anahtarıyla sunucudan okur. Bağlantı koparsa
ekranlar 15 saniyede bir sormaya devam eder.

Hazır bildirimi: müşteri takip sayfasında "Hazır olunca haber ver"e basar, tarayıcının izin penceresi çıkar.
İzin verirse bildirim adresi yalnızca o siparişe kaydedilir (`sunucu/003_bildirim_rapor.sql`); personel "Hazır"a
basınca `supabase/functions/tetra-bildir` işlevi telefona bildirim gönderir ve kaydı siler. Telefon numarası
toplanmaz. iPhone, ana ekrana eklenmemiş sayfalara bildirim izni vermez; orada sayfa açıkken sesli uyarı çalışır.
İşlevin gizli değerleri (VAPID_PUBLIC, VAPID_PRIVATE) Supabase → Edge Functions → Secrets altındadır.

Raporlar: 90 günden eski siparişler günlük özete dönüşür (`tetra_gun_ozet`), ayrıntıları silinir; raporlar
özeti ve güncel siparişleri birlikte okur.

## Yayın

- Adres: https://tetra.neardiji.com (arama motorlarına kapalı)
- `npm run yayinla` → derler, `dist/` klasörünü tek Worker dosyasına paketler ve Cloudflare'e yükler.
- Tek dosyalık sürüm: `npm run build:tek` → `dist-tek/near-smart-restaurant.html`

## Testler

Testler deneme işletmesinde (`tetra-test`) koşar; hesabın bilgileri ortam değişkeniyle verilir, repoda yer almaz.

```bash
TETRA_TEST_EPOSTA=... TETRA_TEST_SIFRE=... node testler/api.mjs    # sunucu işlevleri: 65 kontrol
TETRA_TEST_EPOSTA=... TETRA_TEST_SIFRE=... node testler/e2e.cjs    # gerçek tarayıcıyla uçtan uca: 56 kontrol
TETRA_TEST_EPOSTA=... TETRA_TEST_SIFRE=... node testler/canli.cjs  # kasa → mutfak → TV → müşteri, dört cihazla: 24 kontrol
```

Tarayıcı testleri Playwright ister; başka adresi sınamak için başına `U=http://localhost:4173` eklenir.

## Tema

Renkler `src/index.css` içindeki `@theme` bloğunda tanımlıdır (Tailwind v4). Zemin NEAR mono (krem / siyah),
vurgu mavidir; vurgu rengi tarihsel nedenle `gold` adını taşır. Koyu tema aynı adları
`:root[data-theme="dark"]` altında yeniden tanımlar; seçim cihazda `sr-tema` anahtarıyla saklanır.
