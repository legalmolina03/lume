import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type {
  AccentName,
  SettingsPatch,
  ThemeName,
  UserSettings,
} from '../lib/types'
import { useAuth } from './AuthContext'

export const ACCENTS: { name: AccentName; label: string; swatch: string }[] = [
  { name: 'red', label: 'Red', swatch: '#ef4444' },
  { name: 'purple', label: 'Purple', swatch: '#8b5cf6' },
  { name: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { name: 'white', label: 'White', swatch: '#ededf2' },
]

const LOCAL_KEY = 'lume.appearance'

interface Appearance {
  theme: ThemeName
  accent: AccentName
}

const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', accent: 'purple' }

interface SettingsValue {
  settings: UserSettings | null
  theme: ThemeName
  accent: AccentName
  setTheme: (theme: ThemeName) => void
  setAccent: (accent: AccentName) => void
  updateSettings: (patch: SettingsPatch) => Promise<void>
  loading: boolean
}

const SettingsContext = createContext<SettingsValue | null>(null)

/**
 * Appearance is read from localStorage before the network so the app never
 * flashes the wrong theme on load, then reconciled with the user's stored
 * settings row once it arrives.
 */
function readLocalAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      accent: (['red', 'purple', 'blue', 'white'] as const).includes(
        parsed.accent as AccentName,
      )
        ? (parsed.accent as AccentName)
        : DEFAULT_APPEARANCE.accent,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // See DataContext: the user object is replaced on every token refresh, so
  // everything downstream keys off the stable id instead.
  const userId = user?.id ?? null
  const [appearance, setAppearance] = useState<Appearance>(readLocalAppearance)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Apply to <html> so every token in index.css re-resolves app-wide.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', appearance.theme === 'light')
    root.classList.toggle('dark', appearance.theme === 'dark')
    root.dataset.accent = appearance.accent
    localStorage.setItem(LOCAL_KEY, JSON.stringify(appearance))

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute(
        'content',
        appearance.theme === 'light' ? '#f7f7fa' : '#0b0b10',
      )
    }
  }, [appearance])

  useEffect(() => {
    if (!userId) {
      setSettings(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (data) {
          setSettings(data)
          setAppearance({ theme: data.theme, accent: data.accent })

          // Reminders are scheduled against the stored timezone, so a stale
          // one silently fires them at the wrong hour. Trust the device and
          // keep the row in step — including after a move or a DST shift.
          const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
          if (deviceZone && deviceZone !== data.timezone) {
            void supabase
              .from('user_settings')
              .update({ timezone: deviceZone })
              .eq('user_id', userId)
              .then(() => {
                if (active) setSettings((prev) => prev && { ...prev, timezone: deviceZone })
              })
          }
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  const persist = useCallback(
    async (patch: SettingsPatch) => {
      if (!userId) return
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: userId, ...patch, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
        .select()
        .single()
      if (error) throw error
      setSettings(data)
    },
    [userId],
  )

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      theme: appearance.theme,
      accent: appearance.accent,
      loading,

      setTheme(theme) {
        setAppearance((prev) => ({ ...prev, theme }))
        void persist({ theme }).catch(() => {})
      },

      setAccent(accent) {
        setAppearance((prev) => ({ ...prev, accent }))
        void persist({ accent }).catch(() => {})
      },

      updateSettings: persist,
    }),
    [settings, appearance, loading, persist],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
