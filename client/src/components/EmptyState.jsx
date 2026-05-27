import styles from './EmptyState.module.css'

export default function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div className={styles.container}>
      {Icon && <div className={styles.icon}><Icon size={48} color="var(--faint)" /></div>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <button className={styles.button} onClick={action}>
          {actionLabel || 'Get started'}
        </button>
      )}
    </div>
  )
}
