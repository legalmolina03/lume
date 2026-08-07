import { supabase } from './supabase'

/**
 * Spotify Web API integration.
 *
 * Authorization Code with PKCE, not the implicit or client-secret flows: a
 * browser app cannot keep a secret, and PKCE is the only Spotify flow that
 * both avoids one and still yields a refresh token.
 *
 * This drives playback on whatever device Spotify is already active on — it
 * does not play audio itself. The Web Playback SDK, which would, is desktop-
 * browser only and so useless to a phone-first app.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

const VERIFIER_KEY = 'lume.spotify.verifier'
const RETURN_KEY = 'lume.spotify.return'

/**
 * `user-read-playback-state` and `user-modify-playback-state` cover reading
 * and driving the active device; `playlist-read-*` is only so the settings
 * screen can offer a picker instead of asking for a pasted URI.
 */
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

export const spotifyClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || null

export function isSpotifyConfigured(): boolean {
  return Boolean(spotifyClientId)
}

/** Must match a redirect URI registered on the Spotify app, exactly. */
export function redirectUri(): string {
  return `${window.location.origin}/spotify/callback`
}

/* -------------------------------------------------------------------------- */
/* PKCE                                                                        */
/* -------------------------------------------------------------------------- */

function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Sends the browser to Spotify's consent screen. */
export async function beginSpotifyAuth(returnTo = '/settings'): Promise<void> {
  if (!spotifyClientId) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set.')

  const verifier = randomString(48)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(RETURN_KEY, returnTo)

  const params = new URLSearchParams({
    client_id: spotifyClientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state: randomString(8),
  })

  window.location.href = `${AUTH_URL}?${params}`
}

export function consumeReturnPath(): string {
  const path = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  sessionStorage.removeItem(RETURN_KEY)
  return path
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

async function persistTokens(
  userId: string,
  token: TokenResponse,
  fallbackRefresh?: string,
): Promise<void> {
  const refresh = token.refresh_token ?? fallbackRefresh
  if (!refresh) throw new Error('Spotify did not return a refresh token.')

  const { error } = await supabase.from('spotify_tokens').upsert(
    {
      user_id: userId,
      access_token: token.access_token,
      refresh_token: refresh,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/** Exchanges the `?code=` from the callback for tokens. */
export async function completeSpotifyAuth(
  userId: string,
  code: string,
): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('Missing PKCE verifier — restart the connection.')
  if (!spotifyClientId) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set.')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: spotifyClientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })

  const token = (await res.json()) as TokenResponse & { error_description?: string }
  if (!res.ok) {
    throw new Error(token.error_description ?? 'Spotify rejected the sign-in.')
  }

  sessionStorage.removeItem(VERIFIER_KEY)
  await persistTokens(userId, token)

  // Store the display name so settings can show who is connected.
  const me = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (me.ok) {
    const profile = (await me.json()) as { display_name?: string }
    await supabase
      .from('spotify_tokens')
      .update({ display_name: profile.display_name ?? null })
      .eq('user_id', userId)
  }
}

export interface SpotifyConnection {
  access_token: string
  refresh_token: string
  expires_at: string
  display_name: string | null
}

/**
 * A usable access token, refreshing when it is close to expiry.
 *
 * The 60-second margin matters: a token that passes a bare expiry check can
 * still expire in flight, and the resulting 401 surfaces as an unexplained
 * failure rather than a retry.
 */
export async function getAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('spotify_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null

  const expiresAt = new Date(data.expires_at).getTime()
  if (expiresAt - Date.now() > 60_000) return data.access_token

  if (!spotifyClientId) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: spotifyClientId,
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }),
  })

  if (!res.ok) {
    // The grant is dead (revoked, or the app's scopes changed). Drop the row so
    // the UI offers to reconnect instead of failing silently forever.
    await supabase.from('spotify_tokens').delete().eq('user_id', userId)
    return null
  }

  const token = (await res.json()) as TokenResponse
  await persistTokens(userId, token, data.refresh_token)
  return token.access_token
}

export async function disconnectSpotify(userId: string): Promise<void> {
  const { error } = await supabase
    .from('spotify_tokens')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

export interface NowPlaying {
  isPlaying: boolean
  track: string
  artist: string
  albumArt: string | null
  deviceName: string | null
}

export interface PlaylistSummary {
  uri: string
  name: string
  trackCount: number
}

async function call(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const token = await getAccessToken(userId)
  if (!token) return null
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

export async function fetchNowPlaying(userId: string): Promise<NowPlaying | null> {
  const res = await call(userId, '/me/player')
  // 204 means Spotify is connected but nothing is active on any device.
  if (!res || res.status === 204 || !res.ok) return null

  const data = (await res.json()) as {
    is_playing: boolean
    item?: {
      name: string
      artists: { name: string }[]
      album?: { images?: { url: string }[] }
    }
    device?: { name: string }
  }

  if (!data.item) return null

  return {
    isPlaying: data.is_playing,
    track: data.item.name,
    artist: data.item.artists.map((a) => a.name).join(', '),
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    deviceName: data.device?.name ?? null,
  }
}

export async function fetchPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const res = await call(userId, '/me/playlists?limit=50')
  if (!res?.ok) return []
  const data = (await res.json()) as {
    items: { uri: string; name: string; tracks: { total: number } }[]
  }
  return data.items.map((p) => ({
    uri: p.uri,
    name: p.name,
    trackCount: p.tracks.total,
  }))
}

/** Errors are surfaced as text so the UI can explain *why* nothing happened. */
async function command(
  userId: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<string | null> {
  const res = await call(userId, path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res) return 'Spotify is not connected.'
  if (res.status === 404) {
    return 'No active Spotify device. Start playing something on a device first.'
  }
  if (res.status === 403) {
    return 'Spotify refused the command — playback control needs Premium.'
  }
  if (!res.ok && res.status !== 202) {
    const detail = await res.text()
    return `Spotify error ${res.status}: ${detail.slice(0, 120)}`
  }
  return null
}

export function play(userId: string, contextUri?: string) {
  return command(
    userId,
    '/me/player/play',
    'PUT',
    contextUri ? { context_uri: contextUri } : undefined,
  )
}

export const pause = (userId: string) => command(userId, '/me/player/pause', 'PUT')
export const next = (userId: string) => command(userId, '/me/player/next', 'POST')
export const previous = (userId: string) =>
  command(userId, '/me/player/previous', 'POST')
