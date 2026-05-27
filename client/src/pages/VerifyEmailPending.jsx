import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Button from '../components/ui/Button'
import styles from './VerifyEmailPending.module.css'

export default function VerifyEmailPending() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getAccessTokenSilently, logout } = useAuth0()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const email = location.state?.email || 'your email'

  async function handleResendEmail() {
    setResending(true)
    try {
      const token = await getAccessTokenSilently()
      const response = await fetch('/api/account/send-verification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        setResent(true)
        setTimeout(() => setResent(false), 3000)
      } else {
        alert('Failed to resend verification email')
      }
    } catch (err) {
      console.error('Error resending email:', err)
      alert('Failed to resend verification email')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Verify Your Email</h1>
        <p className={styles.subtitle}>
          We sent a verification link to <strong>{email}</strong>
        </p>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div>Check your email inbox</div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div>Click the verification link</div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div>You'll be redirected to your dashboard</div>
          </div>
        </div>

        <p className={styles.tip}>
          💡 The link expires in 24 hours. Check your spam folder if you don't see it.
        </p>

        <div className={styles.actions}>
          <Button
            onClick={handleResendEmail}
            loading={resending}
            variant="secondary"
          >
            {resent ? '✓ Email sent!' : 'Resend email'}
          </Button>
          <Button
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            variant="secondary"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
