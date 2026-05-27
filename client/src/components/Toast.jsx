import { useState, useCallback, createContext, useContext } from 'react'
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import styles from './Toast.module.css'

export const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, options = {}) => {
    const id = Date.now()
    const {
      type = 'info', // 'info', 'success', 'error', 'warning'
      duration = 4000, // milliseconds, 0 = no auto-dismiss
      action = null, // { label, onClick }
    } = options

    setToasts(prev => [...prev, { id, message, type, action }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const value = { addToast, removeToast }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  const Icon = getIcon(toast.type)
  const className = `${styles.toast} ${styles[toast.type]}`

  return (
    <div className={className}>
      <div className={styles.content}>
        <Icon size={18} className={styles.icon} />
        <div className={styles.message}>{toast.message}</div>
        {toast.action && (
          <button
            className={styles.action}
            onClick={() => {
              toast.action.onClick()
              onRemove()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button className={styles.close} onClick={onRemove}>
        <X size={16} />
      </button>
    </div>
  )
}

function getIcon(type) {
  switch (type) {
    case 'success':
      return CheckCircle
    case 'error':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    case 'info':
    default:
      return Info
  }
}
