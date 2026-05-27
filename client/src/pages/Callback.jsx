import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

export default function Callback() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error, user } = useAuth0()

  useEffect(() => {
    console.log('[Callback] Auth state:', { isLoading, isAuthenticated, error, user })
  }, [isLoading, isAuthenticated, error, user])

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isLoading, isAuthenticated, navigate])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'red', flexDirection: 'column' }}>
        <div>Login failed:</div>
        <div>{error.message}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
      Logging in…
    </div>
  )
}
