import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  disconnectSpotify,
  fetchNowPlaying,
  getAccessToken,
  isSpotifyConfigured,
  next as skipNext,
  pause as pauseApi,
  play as playApi,
  previous as skipPrevious,
} from '../lib/spotify'
import type { NowPlaying } from '../lib/spotify'

/**
 * Connection state plus transport controls for the focus view.
 *
 * Now-playing is polled rather than pushed — Spotify has no webhook for it —
 * and only while the caller asks, so a page that isn't showing it costs
 * nothing. Three seconds is frequent enough to feel live without being rude to
 * a rate-limited API.
 */
const POLL_MS = 3000

export function useSpotify({ poll = false }: { poll?: boolean } = {}) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [connected, setConnected] = useState<boolean | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Avoids overlapping polls when the network is slower than the interval.
  const inFlight = useRef(false)

  const checkConnection = useCallback(async () => {
    if (!userId || !isSpotifyConfigured()) {
      setConnected(false)
      return
    }
    setConnected(Boolean(await getAccessToken(userId)))
  }, [userId])

  useEffect(() => {
    void checkConnection()
  }, [checkConnection])

  const refreshNowPlaying = useCallback(async () => {
    if (!userId || inFlight.current) return
    inFlight.current = true
    try {
      setNowPlaying(await fetchNowPlaying(userId))
    } finally {
      inFlight.current = false
    }
  }, [userId])

  useEffect(() => {
    if (!poll || !connected || !userId) return
    void refreshNowPlaying()
    const id = window.setInterval(() => void refreshNowPlaying(), POLL_MS)
    return () => window.clearInterval(id)
  }, [poll, connected, userId, refreshNowPlaying])

  /** Runs a transport command, surfacing Spotify's own explanation on failure. */
  const run = useCallback(
    async (fn: (id: string) => Promise<string | null>) => {
      if (!userId) return
      setBusy(true)
      setError(null)
      try {
        const message = await fn(userId)
        if (message) setError(message)
        // Spotify needs a beat before /me/player reflects the change.
        setTimeout(() => void refreshNowPlaying(), 500)
      } finally {
        setBusy(false)
      }
    },
    [userId, refreshNowPlaying],
  )

  return {
    configured: isSpotifyConfigured(),
    connected,
    nowPlaying,
    error,
    busy,
    clearError: () => setError(null),
    refreshNowPlaying,
    recheck: checkConnection,

    play: (contextUri?: string) => run((id) => playApi(id, contextUri)),
    pause: () => run(pauseApi),
    next: () => run(skipNext),
    previous: () => run(skipPrevious),

    async disconnect() {
      if (!userId) return
      await disconnectSpotify(userId)
      setConnected(false)
      setNowPlaying(null)
    },
  }
}
