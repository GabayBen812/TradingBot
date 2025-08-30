self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'Bot Alert', body: 'New trading signal', url: '/bot' }
    const title = data.title || 'Bot Alert'
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/bot' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch (e) {
    event.waitUntil(self.registration.showNotification('Bot Alert', { body: 'New event', data: { url: '/bot' } }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/bot'
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.includes(url) && 'focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  }))
})


