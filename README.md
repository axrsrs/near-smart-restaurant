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
| `/kasa`, `/mutfak`, `/tv`, `/yonetim` | Sonraki aşamalarda kurulacak ekranların giriş noktası |

Giriş ve PIN şu an **önizleme** modunda: sunucu bağlı değil, bilgiler yalnızca biçim olarak denetlenir
(`src/lib/oturum.ts`). Sunucu bağlanınca yalnızca o dosya değişir.

## Tema

Renkler `src/index.css` içindeki `@theme` bloğunda tanımlıdır (Tailwind v4). Zemin NEAR mono (krem / siyah),
vurgu mavidir; vurgu rengi tarihsel nedenle `gold` adını taşır. Koyu tema aynı adları
`:root[data-theme="dark"]` altında yeniden tanımlar; seçim cihazda `sr-tema` anahtarıyla saklanır.
