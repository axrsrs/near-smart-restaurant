/* Tetra · sipariş bildirimi. Yalnızca "siparişiniz hazır" bildirimini gösterir; hiçbir şeyi önbelleğe almaz. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let v = {}
  try {
    v = e.data ? e.data.json() : {}
  } catch {
    v = {}
  }
  const no = Number.isFinite(v.no) ? v.no : null
  const baslik = no ? `Siparişiniz hazır: ${no}` : 'Siparişiniz hazır'
  e.waitUntil(
    self.registration.showNotification(baslik, {
      body: `${typeof v.isletme === 'string' ? v.isletme.slice(0, 80) + ' · ' : ''}Teslim alabilirsiniz.`,
      tag: typeof v.kod === 'string' ? 'tetra-' + v.kod : 'tetra',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 600],
      icon: '/favicon.svg',
      data: { kod: typeof v.kod === 'string' && /^[0-9a-f]{32}$/.test(v.kod) ? v.kod : '' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const yol = e.notification.data && e.notification.data.kod ? '/t/' + e.notification.data.kod : '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      const acik = liste.find((c) => new URL(c.url).pathname === yol)
      return acik ? acik.focus() : self.clients.openWindow(yol)
    }),
  )
})
