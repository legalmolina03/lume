import { useState } from 'react'
import type { FormEvent } from 'react'
import { LumeWordmark } from '../components/LumeMark'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const { needsEmailConfirm } = await signUp(email, password)
        if (needsEmailConfirm) {
          setNotice('Check your inbox to confirm your address, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LumeWordmark size={30} />
          <p className="text-sm text-muted">Light your day. Build your way.</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Password"
            hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
          >
            <Input
              type="password"
              value={password}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              required
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <ErrorBanner message={error} />
          {notice && (
            <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent">
              {notice}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setNotice(null)
            }}
            className="text-xs text-muted transition-colors hover:text-text"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
