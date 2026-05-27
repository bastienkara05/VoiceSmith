import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import Button from '../components/ui/Button'
import styles from './VerifyEmail.module.css'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const api = useApi()
  const toast = useToast()
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      const email = searchParams.get('email')

      if (!token || !email) {
        setError('Invalid verification link')
        setVerifying(false)
        return
      }

      try {
        await api.post('/account/verify-email', { token, email })
        setVerified(true)
        toast.addToast('Email verified! You can now use your account.', { type: 'success' })
        setTimeout(() => navigate('/dashboard'), 2000)
      } catch (err) {
        console.error('Verification error:', err)
        setError('Failed to verify email. Link may have expired.')
        setVerifying(false)
      }
    }

    verifyEmail()
  }, [searchParams, api, navigate, toast])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {verifying && (
          <>
            <h1>Verifying Email...</h1>
            <p>Please wait while we verify your email address.</p>
            <div className={styles.spinner}></div>
          </>
        )}

        {verified && (
          <>
            <h1>✓ Email Verified!</h1>
            <p>Your email has been verified successfully.</p>
            <p>Redirecting you to your dashboard...</p>
          </>
        )}

        {error && (
          <>
            <h1>Verification Failed</h1>
            <p className={styles.error}>{error}</p>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
