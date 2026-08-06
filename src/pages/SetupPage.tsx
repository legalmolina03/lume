import { LumeWordmark } from '../components/LumeMark'

/**
 * Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing, which is
 * the state of a fresh clone. Better than an opaque network failure.
 */
export function SetupPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4">
          <LumeWordmark size={24} />
        </div>

        <h1 className="mb-2 text-base font-semibold">Connect a database</h1>
        <p className="mb-4 text-sm text-muted">
          Lume needs a Supabase project before it can store anything. Create one,
          run <code className="text-text">supabase/migrations/0001_init.sql</code>{' '}
          against it, then add its URL and anon key to{' '}
          <code className="text-text">.env.local</code>:
        </p>

        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
          {`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>`}
        </pre>

        <p className="mt-4 text-xs text-muted">
          Restart the dev server after editing the file — Vite reads environment
          variables at startup.
        </p>
      </div>
    </div>
  )
}
