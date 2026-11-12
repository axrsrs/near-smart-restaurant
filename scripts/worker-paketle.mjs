/* dist/ klasörünü tek bir Cloudflare Worker dosyasına paketler: dist-worker/worker.js
   Dosyalar Worker'ın içine gömülür; ayrı dosya yüklemesi gerekmez. Güvenlik başlıkları burada eklenir. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const KAYNAK = 'dist'
const TUR = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

async function tara(klasor) {
  const liste = []
  for (const d of await readdir(klasor, { withFileTypes: true })) {
    const yol = join(klasor, d.name)
    if (d.isDirectory()) liste.push(...(await tara(yol)))
    else if (d.name !== '_headers') liste.push(yol)
  }
  return liste
}

const dosyalar = {}
for (const yol of await tara(KAYNAK)) {
  const tur = TUR[extname(yol)]
  if (!tur) throw new Error(`Bilinmeyen dosya türü: ${yol}`)
  dosyalar['/' + relative(KAYNAK, yol).split('\\').join('/')] = [tur, (await readFile(yol)).toString('base64')]
}

const kod = `const DOSYA = ${JSON.stringify(dosyalar)};
const BASLIK = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self'; img-src 'self' data: https:; connect-src 'self' https://rfwgjzkewtjpdcvrhepg.supabase.co wss://rfwgjzkewtjpdcvrhepg.supabase.co; worker-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000"
};
const onbellek = new Map();
function govde(yol) {
  let b = onbellek.get(yol);
  if (!b) { b = Uint8Array.from(atob(DOSYA[yol][1]), (c) => c.charCodeAt(0)); onbellek.set(yol, b); }
  return b;
}
/* Çeviri: NearMenu'nün çeviri servisine iletilir (tek kaynak). Yalnızca giriş yapmış kullanıcının oturum anahtarıyla çalışır;
   kullanıcı başına hız sınırını o servis uygular. Gövde 2 KB ile sınırlıdır. */
async function ceviri(istek) {
  const yetki = istek.headers.get("Authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]{20,}$/.test(yetki)) return new Response('{"error":"Giriş yapmalısınız."}', { status: 401, headers: { ...BASLIK, "Content-Type": "application/json" } });
  const govde = await istek.text();
  if (govde.length > 2000) return new Response('{"error":"Metin çok uzun."}', { status: 413, headers: { ...BASLIK, "Content-Type": "application/json" } });
  const y = await fetch("https://media.neardiji.com/translate", { method: "POST", headers: { Authorization: yetki, "Content-Type": "application/json", Origin: "https://neardiji.com" }, body: govde });
  return new Response(await y.text(), { status: y.status, headers: { ...BASLIK, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
export default {
  fetch(istek) {
    if (istek.method === "POST" && new URL(istek.url).pathname === "/ceviri") return ceviri(istek);
    if (istek.method !== "GET" && istek.method !== "HEAD") return new Response("Yalnızca GET", { status: 405, headers: BASLIK });
    let yol = new URL(istek.url).pathname;
    /* dosya değilse tek sayfa uygulamasının girişi döner (ör. /kasa, /t/kod) */
    if (!DOSYA[yol]) {
      const son = yol.slice(yol.lastIndexOf("/") + 1);
      if (yol.startsWith("/assets/") || son.startsWith(".") || son.includes(".") || yol.includes("/.")) return new Response("Bulunamadı", { status: 404, headers: BASLIK });
      yol = "/index.html";
    }
    const h = new Headers(BASLIK);
    h.set("Content-Type", DOSYA[yol][0]);
    h.set("Cache-Control", yol.startsWith("/assets/") ? "public, max-age=31536000, immutable" : yol.startsWith("/sesler/") ? "public, max-age=2592000" : "no-cache");
    return new Response(istek.method === "HEAD" ? null : govde(yol), { headers: h });
  }
};
`
await mkdir('dist-worker', { recursive: true })
await writeFile('dist-worker/worker.js', kod)
console.log(`dist-worker/worker.js · ${Object.keys(dosyalar).length} dosya · ${(kod.length / 1024).toFixed(0)} KB`)
