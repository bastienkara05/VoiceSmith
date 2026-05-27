import { useState, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import styles from './Settings.module.css'

const PLAN_LABELS = { free: 'Free', pro: 'Indie', indie: 'Indie', studio: 'Studio' }

export default function Settings() {
  const { user, logout } = useAuth0()
  const api = useApi()
  const toast = useToast()
  const [usage, setUsage] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    // Fetch usage on mount only (empty dependency array)
    api.get('/voice/usage')
      .then(r => setUsage(r.data))
      .catch(err => {
        console.error('Failed to fetch usage:', err)
        // Don't show error toast here - let global handler catch it once
      })
  }, [])

  function handleUpgrade(planKey) {
    // This will be connected to Stripe checkout
    // For now, show a helpful message
    toast.addToast('Stripe integration coming soon. Please contact support to upgrade.', {
      type: 'info',
      duration: 5000
    })
    // Placeholder: In production, this would redirect to Stripe checkout
    // window.location.href = `/api/billing/checkout/${planKey}`
  }

  async function deleteAccount() {
    if (deleteEmail !== user?.email) {
      toast.addToast('Email does not match. Please try again.', { type: 'error' })
      return
    }

    setDeletingAccount(true)
    try {
      await api.delete('/account')
      toast.addToast('Account deleted successfully.', { type: 'success', duration: 2000 })
      // Log out after account is deleted
      setTimeout(() => {
        logout({ logoutParams: { returnTo: window.location.origin } })
      }, 1000)
    } catch (err) {
      console.error(err)
      setDeletingAccount(false)
    }
  }

  const pct = usage?.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0
  const resetDate = usage?.reset_at ? new Date(usage.reset_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }) : '—'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.sub}>Manage your account and subscription</p>
      </div>

      <div className={styles.sections}>

        {/* Account */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Account</div>
          <div className={styles.card}>
            <div className={styles.profileRow}>
              <div className={styles.avatar}>
                {user?.picture
                  ? <img src={user.picture} alt="" className={styles.avatarImg} />
                  : user?.name?.[0] || '?'
                }
              </div>
              <div>
                <div className={styles.userName}>{user?.name}</div>
                <div className={styles.userEmail}>{user?.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Usage</div>
          {usage && pct >= 80 && usage.limit && (
            <div style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              background: pct >= 100 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(243, 156, 18, 0.1)',
              border: `1px solid ${pct >= 100 ? 'var(--error)' : '#f39c12'}`,
              borderRadius: '6px',
              color: pct >= 100 ? 'var(--error)' : '#f39c12',
              fontSize: '0.9rem'
            }}>
              {pct >= 100
                ? '⚠️ Generation limit reached. Upgrade your plan to continue generating voice lines.'
                : `⚠️ You're using ${pct}% of your monthly generation limit. Consider upgrading soon.`
              }
            </div>
          )}
          <div className={styles.card}>
            {usage ? (
              <>
                <div className={styles.planRow}>
                  <span className={styles.planBadge}>{PLAN_LABELS[usage.plan] || usage.plan}</span>
                  <span className={styles.planGenCount}>
                    {usage.used} / {usage.limit ?? '∞'} generations this month
                  </span>
                </div>
                {usage.limit && (
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%`, background: pct > 80 ? 'var(--error)' : 'var(--accent)' }} />
                  </div>
                )}
                <p className={styles.resetNote}>Resets {resetDate}</p>
              </>
            ) : (
              <div className={styles.loadingSmall}>Loading…</div>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Plan</div>
          <div className={styles.planGrid}>
            {[
              { key: 'free',   label: 'Free',   price: '$0',  gens: '20/mo',  features: ['5 presets', '1 project', 'WAV export'] },
              { key: 'indie',  label: 'Indie',  price: '$19', gens: '500/mo', features: ['5 presets', 'Unlimited projects', 'ZIP export'] },
              { key: 'studio', label: 'Studio', price: '$49', gens: '∞',      features: ['5 presets', 'Unlimited', 'Priority generation'] },
            ].map(p => (
              <div key={p.key} className={`${styles.planCard} ${usage?.plan === p.key ? styles.planCurrent : ''}`}>
                <div className={styles.planLabel}>{p.label}</div>
                <div className={styles.planPrice}>{p.price}<span>/mo</span></div>
                <div className={styles.planGens}>{p.gens} generations</div>
                <ul className={styles.planFeatures}>
                  {p.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                {usage?.plan === p.key
                  ? <div className={styles.currentPlanTag}>Current plan</div>
                  : <Button
                      variant={p.key === 'indie' ? 'primary' : 'ghost'}
                      size="sm"
                      style={{ width: '100%' }}
                      onClick={() => handleUpgrade(p.key)}
                    >
                      Upgrade to {p.label}
                    </Button>
                }
              </div>
            ))}
          </div>
          <p className={styles.stripeNote}>Billing powered by Stripe — add your Stripe integration to enable upgrades.</p>
        </div>

        {/* Danger */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Danger zone</div>
          <div className={styles.card}>
            <div className={styles.dangerRow}>
              <div>
                <div className={styles.dangerLabel}>Delete account</div>
                <div className={styles.dangerSub}>Permanently delete your account and all projects. This cannot be undone.</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>Delete account</Button>
            </div>
          </div>
        </div>

      </div>

      {/* Delete account confirmation modal */}
      <Modal open={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeleteEmail('') }} title="Delete account?">
        <div className={styles.modalBody}>
          <p style={{ color: 'var(--muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            This will permanently delete your account and all projects, characters, and voice lines. This cannot be undone.
          </p>
          <p style={{ color: 'var(--text)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            To confirm, type your email address:
          </p>
          <input
            type="email"
            placeholder={user?.email}
            value={deleteEmail}
            onChange={e => setDeleteEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteEmail('') }}>Cancel</Button>
            <Button
              variant="danger"
              onClick={deleteAccount}
              loading={deletingAccount}
              disabled={deleteEmail !== user?.email}
            >
              Delete my account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
