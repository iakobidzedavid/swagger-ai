'use client'

import { useState } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SigninModalProps {
  isOpen: boolean
  onSignin: (email: string, companyName?: string) => Promise<void>
  onClose?: () => void
  isLoading?: boolean
  error?: string | null
  domain?: string
}

export function SigninModal({
  isOpen,
  onSignin,
  onClose,
  isLoading = false,
  error = null,
  domain,
}: SigninModalProps) {
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  if (!isOpen) return null

  const validateEmail = (value: string) => {
    if (!value) {
      setEmailError('Email is required')
      return false
    }
    if (!EMAIL_RE.test(value)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) return

    setSigningIn(true)
    try {
      await onSignin(email, companyName || undefined)
    } finally {
      setSigningIn(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 className="text-h2" style={{ marginBottom: '8px' }}>
          Sign in to continue
        </h2>
        <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
          Create your account to generate and manage your branded storefront.
        </p>

        {error && (
          <div
            className="error-banner"
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'var(--color-error-bg)',
              borderLeft: '4px solid var(--color-error)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="email" className="text-small font-semibold" style={{ display: 'block', marginBottom: '8px' }}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={signingIn || isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: emailError ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontFamily: 'inherit',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
            {emailError && <p className="text-small text-error" style={{ marginTop: '4px' }}>{emailError}</p>}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="companyName" className="text-small font-semibold" style={{ display: 'block', marginBottom: '8px' }}>
              Company Name (optional)
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={domain ? domain.split('.')[0] : 'Your Company'}
              disabled={signingIn || isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontFamily: 'inherit',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={signingIn || isLoading || !email}
            className="btn btn-primary btn-full"
            style={{
              marginBottom: '12px',
              opacity: signingIn || isLoading || !email ? 0.5 : 1,
              cursor: signingIn || isLoading || !email ? 'not-allowed' : 'pointer',
            }}
          >
            {signingIn || isLoading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={signingIn || isLoading}
              className="btn btn-secondary btn-full"
              style={{
                opacity: signingIn || isLoading ? 0.5 : 1,
                cursor: signingIn || isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </form>

        <p className="text-small text-muted" style={{ marginTop: '16px', textAlign: 'center' }}>
          Passwordless sign in — we'll email you a verification link.
        </p>
      </div>
    </div>
  )
}
