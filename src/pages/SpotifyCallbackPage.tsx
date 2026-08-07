import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LumeMark } from '../components/LumeMark'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { completeSpotifyAuth, consumeReturnPath } from '../lib/spotify'

/**
 * Where Spotify sends the browser back to. Trades the one-time `?code=` for
 * tokens, then returns to whatever page started the connection.
 */
export function SpotifyCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  // The code is single-use, and StrictMode double-invokes effects in dev.
  // Without this guard the second attempt fails with invalid_grant.
  const exchanged = useRef(false)

  useEffect(() => {
    if (loading || !user || exchanged.current) return

    const denied = params.get('error')
    if (denied) {
      setError(
        denied === 'access_denied'
          ? 'Spotify access was declined.'
          : `Spotify returned: ${denied}`,
      )
      return
    }

    const code = params.get('code')
    if (!code) {
      setError('Spotify did not return an authorisation code.')
      return
    }

    exchanged.current = true
    completeSpotifyAuth(user.id, code)
      .then(() => navigate(consumeReturnPath(), { replace: true }))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not connect Spotify.'),
      )
  }, [loading, user, params, navigate])

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <LumeMark
          size={36}
          className={`mx-auto text-accent ${error ? '' : 'animate-pulse'}`}
        />
        <p className="mt-4 text-sm text-muted">
          {error ? 'Spotify connection failed.' : 'Connecting Spotify…'}
        </p>

        {error && (
          <div className="mt-4 flex flex-col gap-3">
            <ErrorBanner message={error} />
            <Button onClick={() => navigate('/settings', { replace: true })}>
              Back to settings
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
