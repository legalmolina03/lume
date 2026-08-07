import { useCallback, useEffect, useState } from 'react'
import { Music, Unlink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useSpotify } from '../../hooks/useSpotify'
import { beginSpotifyAuth, fetchPlaylists, redirectUri } from '../../lib/spotify'
import type { PlaylistSummary } from '../../lib/spotify'
import { Button } from '../ui/Button'
import { Card, ErrorBanner, SectionHeader } from '../ui/Card'
import { Field, Segmented, Select } from '../ui/Field'

export function SpotifyCard() {
  const { user } = useAuth()
  const { settings, updateSettings } = useSettings()
  const spotify = useSpotify()
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadPlaylists = useCallback(async () => {
    if (!user || !spotify.connected) return
    setPlaylists(await fetchPlaylists(user.id))
  }, [user, spotify.connected])

  useEffect(() => {
    void loadPlaylists()
  }, [loadPlaylists])

  if (!spotify.configured) {
    return (
      <Card>
        <SectionHeader title="Spotify" hint="Not configured" />
        <p className="text-xs text-muted">
          Set <code className="text-text">VITE_SPOTIFY_CLIENT_ID</code> to the
          client ID of a Spotify app, and register this redirect URI on it:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-2 p-2 text-[11px] text-muted">
          {redirectUri()}
        </pre>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHeader
        title="Spotify"
        hint={
          spotify.connected === null
            ? 'Checking…'
            : spotify.connected
              ? 'Connected'
              : 'Not connected'
        }
      />

      <ErrorBanner message={error ?? spotify.error} />

      {!spotify.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Start your focus playlist automatically, and control playback
            without leaving the timer.
          </p>
          <Button
            variant="primary"
            onClick={() =>
              beginSpotifyAuth('/settings').catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Could not start sign-in.'),
              )
            }
          >
            <Music size={14} />
            Connect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label="Focus playlist"
            hint="Left as None, a focus session just controls whatever is already playing."
          >
            <Select
              value={settings?.spotify_playlist_uri ?? ''}
              onChange={(e) => {
                const uri = e.target.value
                const found = playlists.find((p) => p.uri === uri)
                void updateSettings({
                  spotify_playlist_uri: uri || null,
                  spotify_playlist_name: found?.name ?? null,
                }).catch(() => {})
              }}
            >
              <option value="">None</option>
              {playlists.map((p) => (
                <option key={p.uri} value={p.uri}>
                  {p.name} ({p.trackCount})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start music with a session">
              <Segmented<'on' | 'off'>
                label="Autoplay"
                value={settings?.spotify_autoplay === false ? 'off' : 'on'}
                onChange={(v) =>
                  void updateSettings({ spotify_autoplay: v === 'on' }).catch(() => {})
                }
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
              />
            </Field>

            <Field label="Pause when it ends">
              <Segmented<'on' | 'off'>
                label="Autopause"
                value={settings?.spotify_autopause === false ? 'off' : 'on'}
                onChange={(v) =>
                  void updateSettings({ spotify_autopause: v === 'on' }).catch(() => {})
                }
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] text-muted">
              Lume drives whatever device Spotify is already playing on. It
              can't start one from nothing — open Spotify somewhere first.
            </p>
            <Button onClick={() => void spotify.disconnect()}>
              <Unlink size={14} />
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
