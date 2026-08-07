import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { DataProvider } from './context/DataContext'
import { isSupabaseConfigured } from './lib/supabase'
import { AppShell } from './components/AppShell'
import { LumeMark } from './components/LumeMark'
import { SetupPage } from './pages/SetupPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { OverviewPage } from './pages/OverviewPage'
import { HabitsPage } from './pages/HabitsPage'
import { TasksPage } from './pages/TasksPage'
import { FocusPage } from './pages/FocusPage'
import { CalendarPage } from './pages/CalendarPage'
import { ActivityPage } from './pages/ActivityPage'
import { SettingsPage } from './pages/SettingsPage'
import { SpotifyCallbackPage } from './pages/SpotifyCallbackPage'

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <LumeMark size={40} className="animate-pulse text-accent" />
    </div>
  )
}

/**
 * Everything behind the auth gate. `DataProvider` sits inside it so the store
 * only ever loads for a signed-in user, and is torn down on sign-out.
 */
function AuthenticatedApp() {
  const { user, loading } = useAuth()

  if (loading) return <Splash />
  if (!user) return <AuthPage />

  return (
    <DataProvider>
      <Routes>
        {/* Outside the shell: it is a transient redirect target, not a page. */}
        <Route path="spotify/callback" element={<SpotifyCallbackPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="menu" element={<OverviewPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

export default function App() {
  // Without a database there is nothing to sign into, so this check comes
  // before the providers rather than failing somewhere deeper.
  if (!isSupabaseConfigured) return <SetupPage />

  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <AuthenticatedApp />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
