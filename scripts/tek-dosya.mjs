/* Uygulamayı tek bir HTML dosyasına derler: dist-tek/near-smart-restaurant.html
   Yazı tipleri, logo, stil ve kod dosyanın içindedir; sunucu olmadan, çift tıklayarak açılır. */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { build } from 'vite'

process.env.VITE_TEK_DOSYA = '1'
const GECICI = 'dist-tek/.gecici'
await rm('dist-tek', { recursive: true, force: true })
await build({
  logLevel: 'warn',
  build: { outDir: GECICI, assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false, copyPublicDir: false },
})

const dosyalar = await readdir(`${GECICI}/assets`)
const oku = (uzanti) => readFile(`${GECICI}/assets/${dosyalar.find((d) => d.endsWith(uzanti))}`, 'utf8')
const [css, js, tema] = await Promise.all([oku('.css'), oku('.js'), readFile('public/tema-baslat.js', 'utf8')])
const guvenli = (kod) => kod.replace(/<\/script/gi, '<\\/script')

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#ebe9e5">
<meta name="robots" content="noindex">
<title>Tetra</title>
<script>${guvenli(tema)}</script>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${guvenli(js)}</script>
</body>
</html>
`
await mkdir('dist-tek', { recursive: true })
await writeFile('dist-tek/near-smart-restaurant.html', html)
await rm(GECICI, { recursive: true, force: true })
console.log(`dist-tek/near-smart-restaurant.html · ${(html.length / 1024).toFixed(0)} KB`)
