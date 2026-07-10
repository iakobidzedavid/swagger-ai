'use client'

import { ReactNode, Component, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.retry)
      }

      return (
        <div className="section">
          <div className="container content-narrow">
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto', marginBottom: '16px', opacity: 0.8 }}>
                  <circle cx="24" cy="24" r="22" stroke="var(--color-danger)" strokeWidth="2"/>
                  <path d="M24 16v12M24 36v1" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-h2" style={{ marginBottom: '12px' }}>
                Oops, something went wrong
              </h2>
              <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
                We encountered an unexpected error. Please try again.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{
                  marginBottom: '24px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}>
                  <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: 600 }}>
                    Error details (dev only)
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-danger)' }}>
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
              <button
                onClick={this.retry}
                className="btn btn-primary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
