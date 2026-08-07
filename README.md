# Lume

Habits, tasks and focus in one calm dashboard. An installable PWA built on
React + Vite + Tailwind, with Supabase for auth and storage.

## Setup

### 1. Create the database

Create a Supabase project, then run the migrations against it — either from the
SQL editor or with the CLI:

```bash
supabase db push
```

- `supabase/migrations/0001_init.sql` — tables, RLS policies, the pinned-task
  cap, the signup trigger that seeds the four default life areas, and the
  `activity_log` view.
- `supabase/migrations/0002_schedule_reminders.sql` — the reminder cron. Apply
  this **after** deploying the Edge Function, and edit its two placeholders
  first.

### 2. Point the app at it

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API
settings. Until they are set, the app renders a setup screen instead of failing
at startup.

### 3. Run it

```bash
npm install
npm run dev
```

## Push reminders

Optional, and the only part with extra setup.

Generate a VAPID pair and a random shared secret:

```bash
npx web-push generate-vapid-keys
```

Four values go in as Edge Function secrets (Dashboard → Project Settings →
Edge Functions → Secrets), none of them ever committed:

| Secret | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | from the command above |
| `VAPID_PRIVATE_KEY` | from the command above |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | any random string |

The **public** key also goes in `VITE_VAPID_PUBLIC_KEY` — in `.env.local` for
local dev, and in the host's environment variables for production. It is safe
in client code; the private key is what must stay secret.

Then deploy the function and schedule it:

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

Apply `0002_schedule_reminders.sql` after editing its two placeholders, and
store the same `CRON_SECRET` in Vault as `lume_cron_secret` so the cron job can
present it.

Finally, turn reminders on under Settings and set a habit reminder time.

### How it behaves

The job runs every 15 minutes but only notifies a user whose reminder time
falls inside the current window *and* who has something actually outstanding —
an unlogged habit due today, or a task due or overdue. Nothing pending means no
notification, so the reminder keeps meaning something.

`GET|POST ...?dry=1` returns what it *would* do — timezone, local time, whether
the window is open, subscription count — without sending anything. Useful for
checking the wiring without waiting for a reminder window.

Two deliberate choices:

- **JWT verification is off**, because pg_cron has no user session to present.
  The `CRON_SECRET` header takes its place, checked before anything else runs.
- **It fails closed.** With `CRON_SECRET` unset, every request is rejected
  rather than allowed through, so a half-finished deploy is inert rather than
  an open notification trigger.

## Spotify

Optional. Starts a chosen playlist when a focus session begins, pauses it when
the session ends, and puts now-playing plus transport controls under the timer.

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Register **both** redirect URIs on it:
   - `https://<your-domain>/spotify/callback`
   - `http://127.0.0.1:5173/spotify/callback`
3. Put its client ID in `VITE_SPOTIFY_CLIENT_ID` (locally and on the host)
4. Settings → Spotify → Connect, then pick a focus playlist

There is no client secret. The app uses Authorization Code with PKCE, the only
Spotify flow that both avoids a secret and still returns a refresh token — the
implicit flow does not, and would force a re-login every hour.

Things worth knowing:

- **Playback control requires Premium.** Reading now-playing works on free;
  play/pause/skip returns 403 without it.
- **Spotify rejects `localhost` in redirect URIs** — loopback has to be the
  literal `127.0.0.1`. Browse to `127.0.0.1:5173` when testing locally, or the
  callback will be refused.
- **Lume drives an existing device, it does not play audio.** The Web Playback
  SDK, which would, is desktop-browser only and unusable on a phone. So Spotify
  must already be open somewhere; commands sent with no active device return a
  clear "no active device" message rather than failing silently.
- Tokens are stored per-user in `spotify_tokens` under RLS, not in
  `localStorage`, so connecting on one device covers the others.
- A Spotify app starts in development mode, capped at 25 manually-added users.
  Fine for personal use; opening it up needs a quota extension request.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck, then production build |
| `npm run lint` | oxlint |
| `npm run icons` | Regenerate PWA icons from the starburst mark |

## Layout

```
src/
  components/    UI — ui/ primitives, then feature folders
    RadialNav    The five-section ring (mobile navigation)
  context/       AuthContext, SettingsContext, DataContext
  hooks/         useFocusTimer
  lib/           supabase client, types, date/streak/recurrence logic
  pages/         One per route
  sw.ts          Service worker: offline shell + push handling
supabase/
  migrations/    Schema and cron
  functions/     send-reminders Edge Function
```

## Notes on the build

A few decisions worth knowing about:

- **Ring geometry.** The five sections are spread across a 220° upward arc
  rather than placed literally at top/left/right/bottom-left/bottom-right — the
  FAB sits ~60px above the bottom edge, so literal bottom positions would fall
  off screen. Order and reading are unchanged.
- **The "white" accent** resolves to near-white in dark mode and near-black in
  light mode. A literal white accent is invisible on a light background.
- **Push subscriptions** are their own table rather than a column on the
  settings row, so one account can receive reminders on several devices.
- **Streaks** are measured over each habit's own schedule: days for daily and
  weekly-days habits, whole weeks for `x_per_week`. The period still in progress
  never breaks a streak.
- **Monthly recurrence** skips months without the target date rather than
  clamping, so "the 31st" never quietly becomes the 30th.
- `react-router` carries a high-severity advisory for RSC-mode CSRF. This is a
  client-side SPA and does not use RSC mode, so it does not apply.
