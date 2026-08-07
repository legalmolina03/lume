-- Spotify link-up.
--
-- Tokens live in the database rather than localStorage so authorising once on
-- the laptop also covers the phone. RLS keeps them owner-only, exactly like
-- every other table here.

create table public.spotify_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  access_token  text not null,
  -- Spotify rotates this on refresh, so it is updated in place rather than
  -- assumed constant for the life of the connection.
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.spotify_tokens enable row level security;

create policy "own spotify_tokens" on public.spotify_tokens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Which playlist a focus session should start. Nullable: connecting Spotify
-- without nominating a playlist is a perfectly reasonable state, and just
-- means the session controls whatever is already playing.
alter table public.user_settings
  add column spotify_playlist_uri  text,
  add column spotify_playlist_name text,
  -- Whether starting a focus session should start music, and whether ending
  -- one should pause it. Both opt-in-able independently.
  add column spotify_autoplay boolean not null default true,
  add column spotify_autopause boolean not null default true;
