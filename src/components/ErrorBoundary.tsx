'use client'

import type { ReactNode, ErrorInfo } from 'react'
import { Component } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorStack: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorStack: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    // Update state with error stack for display
    this.setState({
      errorStack: errorInfo.componentStack || error.stack || ''
    })
  }

  retry = () => {
    this.setState({ hasError: false, error: null, errorStack: null })
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
                We encountered an unexpected error. The page will try to recover automatically. If the problem persists, please refresh the page.
              </p>
              {this.state.error && (
                <details style={{
                  marginBottom: '24px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}>
                  <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: 600 }}>
                    Error details
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-danger)', margin: 0 }}>
                    {this.state.error.toString()}
                    {this.state.errorStack && `\n\nStack:\n${this.state.errorStack}`}
                  </pre>
                </details>
              )}
              <button
                onClick={this.retry}
                className="btn btn-primary"
                style={{ marginBottom: '12px' }}
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload()
                  }
                }}
                className="btn btn-secondary"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
