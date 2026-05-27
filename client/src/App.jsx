import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import Landing from './pages/Landing'
import Callback from './pages/Callback'
import Dashboard from './pages/Dashboard'
import Project from './pages/Project'
import Settings from './pages/Settings'
import VerifyEmail from './pages/VerifyEmail'
import VerifyEmailPending from './pages/VerifyEmailPending'
import AppShell from './components/layout/AppShell'
import { ToastProvider } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  if (isLoading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--muted)' }}>Loading…</div>
  if (!isAuthenticated) { loginWithRedirect(); return null; }
  return children
}

export default function App() {
  const { user } = useAuth0()

  // Clear onboarding state when user changes (new account login)
  useEffect(() => {
    if (user?.sub) {
      const lastUserId = localStorage.getItem('voicesmith_last_user_id')
      const currentUserId = user.sub

      // If user changed, reset onboarding
      if (lastUserId && lastUserId !== currentUserId) {
        console.log('[App] User changed, resetting onboarding state')
        localStorage.removeItem('voicesmith_onboarding_complete')
        localStorage.removeItem('voicesmith_onboarding_step')
      }

      // Store current user ID for next comparison
      localStorage.setItem('voicesmith_last_user_id', currentUserId)
    }
  }, [user?.sub])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>
            } />
            <Route path="/project/:id" element={
              <ProtectedRoute><AppShell><Project /></AppShell></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
