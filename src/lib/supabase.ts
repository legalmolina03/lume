import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Config comes from the environment, never from a checked-in constant, so a
 * production deploy is a variable flip rather than a rebuild (Section 7).
 */
// An unset key in .env.local reads as '' rather than undefined, and `??` would
// happily pass that straight to createClient, which throws on it at import
// time — before App can render the setup screen.
const clean = (value: string | undefined) => value?.trim() || null

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

/**
 * True once both variables are present. The app renders a setup screen instead
 * of a stack trace when they are missing, which is the state a fresh clone is
 * in before `.env.local` is filled out.
 */
export const isSupabaseConfigured = Boolean(url && key)

export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  key ?? 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
