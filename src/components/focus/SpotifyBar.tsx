import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { useSpotify } from '../../hooks/useSpotify'
import { IconButton } from '../ui/Button'

/**
 * Now-playing strip under the timer. Deliberately small: it exists so a track
 * can be skipped without leaving the focus screen, which is the whole point of
 * not breaking concentration to go and find Spotify.
 */
export function SpotifyBar({
  spotify,
}: {
  spotify: ReturnType<typeof useSpotify>
}) {
  if (!spotify.configured || !spotify.connected) return null

  const np = spotify.nowPlaying

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2">
      {np?.albumArt ? (
        <img
          src={np.albumArt}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted">
          <Music size={15} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {np ? (
          <>
            <p className="truncate text-xs font-medium">{np.track}</p>
            <p className="truncate text-[11px] text-muted">
              {np.artist}
              {np.deviceName && ` · ${np.deviceName}`}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted">
            Nothing playing. Start Spotify on any device to control it here.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        <IconButton
          aria-label="Previous track"
          disabled={spotify.busy}
          onClick={() => void spotify.previous()}
        >
          <SkipBack size={15} />
        </IconButton>
        <IconButton
          aria-label={np?.isPlaying ? 'Pause' : 'Play'}
          disabled={spotify.busy}
          onClick={() => void (np?.isPlaying ? spotify.pause() : spotify.play())}
        >
          {np?.isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </IconButton>
        <IconButton
          aria-label="Next track"
          disabled={spotify.busy}
          onClick={() => void spotify.next()}
        >
          <SkipForward size={15} />
        </IconButton>
      </div>
    </div>
  )
}
