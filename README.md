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

```bash
npx web-push generate-vapid-keys
```

- Public key → `VITE_VAPID_PUBLIC_KEY` in `.env.local`
- Private key → an Edge Function secret, never committed:

```bash
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
supabase functions deploy send-reminders
```

Then apply `0002_schedule_reminders.sql` and turn reminders on under Settings.
The function runs every 15 minutes but only notifies users whose reminder time
falls in the current window *and* who have something outstanding.

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
