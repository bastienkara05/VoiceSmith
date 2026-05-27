import { Component } from 'react'
import styles from './ErrorBoundary.module.css'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <h1 className={styles.title}>Oops! Something went wrong</h1>
            <p className={styles.message}>
              We encountered an unexpected error. Try refreshing the page or going back to the dashboard.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className={styles.details}>
                <summary>Error details (development only)</summary>
                <pre className={styles.error}>
                  {this.state.error?.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className={styles.actions}>
              <button className={styles.button} onClick={() => window.location.reload()}>
                Refresh Page
              </button>
              <button className={styles.buttonSecondary} onClick={this.handleReset}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
