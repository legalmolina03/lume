import { supabase } from './supabase'

/**
 * Web Push wiring. The browser hands us an endpoint plus two keys; those go in
 * `push_subscriptions` so the scheduled Edge Function can reach this device
 * later. One row per device, not per user — a phone and a laptop are separate
 * subscriptions and both should ring.
 */

export type PushState =
  | 'unsupported'
  | 'denied'
  | 'granted-subscribed'
  | 'granted-unsubscribed'
  | 'default'

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  return existing ? 'granted-subscribed' : 'granted-unsubscribed'
}

/** VAPID keys arrive base64url-encoded; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export async function subscribeToPush(userId: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    throw new Error(
      'VITE_VAPID_PUBLIC_KEY is not set — generate a VAPID key pair first.',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'default'
  }

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }))

  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth || !json.endpoint) {
    throw new Error('The browser returned an incomplete push subscription.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error

  return 'granted-subscribed'
}

export async function unsubscribeFromPush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return 'granted-unsubscribed'

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()

  return 'granted-unsubscribed'
}
