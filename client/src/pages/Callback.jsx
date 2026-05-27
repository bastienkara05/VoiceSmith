import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useApi } from '../hooks/useApi'

export default function Callback() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error, user, getAccessTokenSilently } = useAuth0()
  const [checkingVerification, setCheckingVerification] = useState(false)

  useEffect(() => {
    console.log('[Callback] Auth state:', { isLoading, isAuthenticated, error, user })
  }, [isLoading, isAuthenticated, error, user])

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !checkingVerification) {
      checkEmailVerification()
    }
  }, [isLoading, isAuthenticated, user])

  async function checkEmailVerification() {
    setCheckingVerification(true)
    try {
      const token = await getAccessTokenSilently()
      const response = await fetch('/api/voice/usage', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const userData = await response.json()

      console.log('[Callback] User data:', userData)

      // If email is verified, go to dashboard
      if (userData.email_verified) {
        console.log('[Callback] Email verified, redirecting to dashboard')
        navigate('/dashboard')
      } else {
        // If not verified, send verification email and redirect to pending page
        console.log('[Callback] Email not verified, sending verification email')
        try {
          await fetch('/api/account/send-verification', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: user.email })
          })
        } catch (err) {
          console.error('[Callback] Error sending verification email:', err)
        }
        navigate('/verify-email-pending', { state: { email: user.email } })
      }
    } catch (err) {
      console.error('[Callback] Error checking verification:', err)
      // Default to dashboard if check fails
      navigate('/dashboard')
    }
  }

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
