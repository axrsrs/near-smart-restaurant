# NEAR Smart Restaurant

Self servis ve gel-al işletmeleri için sipariş takip sistemi.

## Geliştirme

```bash
npm install
npm run dev
```

## Ekranlar

| Adres | Ekran |
| --- | --- |
| `/giris` | İşletme girişi (e-posta + şifre) |
| `/ekran` | Bu cihaz hangi ekran olacak: Kasa, Mutfak, TV ekranı, Yönetim |
| `/pin/kasa`, `/pin/mutfak` | Personel girişi (4 haneli PIN) |
| `/yonetim/urunler` | Ürünler, fiyatlar, kategoriler |
| `/yonetim/personel` | Personel, ekran yetkileri, PIN |
| `/yonetim/isletme` | İşletme adı, şube, logo |
| `/kasa`, `/mutfak`, `/tv` | Sonraki aşamalarda kurulacak ekranların giriş noktası |

Şu an **önizleme** modunda çalışır: veriler bu cihazın tarayıcısında saklanır (`src/lib/veri.ts`), yönetici
girişi yalnızca biçim olarak denetlenir (`src/lib/oturum.ts`). Personel PIN'i gerçekten denetlenir; art arda
5 hatalı denemede 30 saniye kilitlenir. Sunucu bağlanınca yalnızca bu iki dosyanın içi değişir.

Tek dosyalık sürüm: `npm run build:tek` → `dist-tek/near-smart-restaurant.html`

## Tema

Renkler `src/index.css` içindeki `@theme` bloğunda tanımlıdır (Tailwind v4). Zemin NEAR mono (krem / siyah),
vurgu mavidir; vurgu rengi tarihsel nedenle `gold` adını taşır. Koyu tema aynı adları
`:root[data-theme="dark"]` altında yeniden tanımlar; seçim cihazda `sr-tema` anahtarıyla saklanır.
