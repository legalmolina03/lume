/// <reference lib="webworker" />

/**
 * Lume's service worker.
 *
 * Two jobs: keep the app shell available offline, and receive push reminders
 * for unlogged habits and due tasks (Section 4).
 *
 * Precaching is hand-rolled rather than delegated to Workbox — the whole shell
 * is a handful of hashed assets, and the routing rules below are short enough
 * that a dependency would cost more than it saves.
 */

declare const self: ServiceWorkerGlobalScope & {
  // Injected at build time by vite-plugin-pwa (injectManifest strategy).
  __WB_MANIFEST: { url: string; revision: string | null }[]
}

const manifest = self.__WB_MANIFEST

const CACHE = `lume-shell-v${manifest.length}-${
  manifest.map((e) => e.revision ?? e.url).join('').length
}`

// Deduplicated: `includeAssets` and `globPatterns` can both claim the same
// file, and `cache.addAll` rejects the whole batch if the list repeats a URL —
// which fails the install and leaves the app with no service worker at all.
const PRECACHE_URLS = [...new Set(manifest.map((entry) => entry.url))]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never cache Supabase calls

  // Navigations fall back to the cached shell so the app opens offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/index.html')
        return cached ?? Response.error()
      }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

/* -------------------------------------------------------------------------- */
/* Push                                                                        */
/* -------------------------------------------------------------------------- */

interface PushPayload {
  title?: string
  body?: string
  /** In-app path to open when the notification is tapped. */
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Lume', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Replaces an earlier reminder of the same kind rather than stacking.
      tag: payload.tag ?? 'lume-reminder',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data?.url as string) ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an open tab if there is one, rather than opening a duplicate.
        for (const client of clients) {
          if ('focus' in client) {
            void client.navigate(target)
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})

export {}
