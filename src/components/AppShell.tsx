import { NavLink, Outlet } from 'react-router-dom'
import { Grid2x2, Home, Settings } from 'lucide-react'
import { LumeWordmark } from './LumeMark'
import { RadialNav } from './RadialNav'
import { CommandPalette } from './CommandPalette'
import { useData } from '../context/DataContext'
import { useSettings } from '../context/SettingsContext'
import { SECTIONS, resolveSectionOrder } from '../lib/sections'
import { ErrorBanner } from './ui/Card'

export function AppShell() {
  const { error } = useData()
  const { settings } = useSettings()

  // Home and the hub are fixed anchors; the five sections follow the user's
  // order so the header, the ring and the hub never disagree.
  const nav = [
    { label: 'Home', path: '/', Icon: Home },
    { label: 'Everything', path: '/menu', Icon: Grid2x2 },
    ...resolveSectionOrder(settings?.section_order).map((key) => SECTIONS[key]),
  ]

  return (
    <div className="min-h-full bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="shrink-0" aria-label="Lume home">
            <LumeWordmark size={20} />
          </NavLink>

          {/* Wide screens get a plain bar; phones get the radial ring instead. */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {nav.map(({ label, path, Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:text-text'
                  }`
                }
              >
                <Icon size={15} strokeWidth={1.6} />
                {label}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors md:ml-0 ${
                isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'
              }`
            }
          >
            <Settings size={17} strokeWidth={1.6} />
          </NavLink>
        </div>
      </header>

      {/* Bottom padding clears the floating FAB on phones. */}
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-32 md:pb-10">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}
        <Outlet />
      </main>

      <div className="md:hidden">
        <RadialNav />
      </div>

      <CommandPalette />
    </div>
  )
}
