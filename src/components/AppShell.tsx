import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  CheckSquare,
  History,
  Home,
  Repeat,
  Settings,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LumeWordmark } from './LumeMark'
import { RadialNav } from './RadialNav'
import { useData } from '../context/DataContext'
import { ErrorBanner } from './ui/Card'

const NAV: { label: string; path: string; Icon: LucideIcon }[] = [
  { label: 'Home', path: '/', Icon: Home },
  { label: 'Habits', path: '/habits', Icon: Repeat },
  { label: 'Tasks', path: '/tasks', Icon: CheckSquare },
  { label: 'Focus', path: '/focus', Icon: Timer },
  { label: 'Calendar', path: '/calendar', Icon: CalendarDays },
  { label: 'Activity', path: '/activity', Icon: History },
]

export function AppShell() {
  const { error } = useData()

  return (
    <div className="min-h-full bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="shrink-0" aria-label="Lume home">
            <LumeWordmark size={20} />
          </NavLink>

          {/* Wide screens get a plain bar; phones get the radial ring instead. */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(({ label, path, Icon }) => (
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
    </div>
  )
}
