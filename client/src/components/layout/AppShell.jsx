import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { LayoutDashboard, Settings, LogOut, Hammer, ChevronRight } from 'lucide-react'
import styles from './AppShell.module.css'

export default function AppShell({ children }) {
  const { user, logout } = useAuth0()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/settings',  icon: Settings,        label: 'Settings' },
  ]

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${sidebarExpanded ? styles.expanded : ''}`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className={styles.logo} onClick={() => navigate('/dashboard')}>
          <Hammer size={18} color="var(--accent2)" />
          <span className={styles.logoText}>VoiceSmith</span>
        </div>

        <nav className={styles.nav}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`${styles.navItem} ${location.pathname === to ? styles.active : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {user?.picture
              ? <img src={user.picture} alt="" className={styles.avatarImg} />
              : <span>{user?.name?.[0] || '?'}</span>
            }
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name || user?.email}</div>
            <div className={styles.userEmail}>{user?.email}</div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
