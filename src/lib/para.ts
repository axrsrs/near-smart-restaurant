/* Fiyatlar kuruş olarak (tam sayı) saklanır; ekranda Türk lirası biçiminde gösterilir. */
const bicim = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

export const tl = (kurus: number) => bicim.format(kurus / 100)

export const EN_YUKSEK_FIYAT = 100_000_000 // 1.000.000 ₺
