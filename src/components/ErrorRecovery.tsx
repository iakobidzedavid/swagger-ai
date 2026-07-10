'use client'

/**
 * ErrorRecovery — user-friendly error display with actionable recovery options
 */

interface ErrorRecoveryProps {
  error: string
  title?: string
  actions?: {
    label: string
    onClick: () => void
    primary?: boolean
  }[]
  icon?: 'validation' | 'network' | 'server' | 'generic'
}

const ErrorIcons = {
  validation: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  network: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5.5v2M8 11v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  server: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 7.5h8M4 11.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  generic: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
}

export function ErrorRecovery({
  error,
  title = 'Something went wrong',
  actions = [],
  icon = 'generic',
}: ErrorRecoveryProps) {
  return (
    <div className="error-banner" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          {ErrorIcons[icon]}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{title}</p>
          <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: actions.length > 0 ? '12px' : 0 }}>
            {error}
          </p>
        </div>
      </div>

      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className={action.primary ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ValidationErrorMessage — inline validation error with icon
 */
interface ValidationErrorMessageProps {
  message: string
  id?: string
}

export function ValidationErrorMessage({ message, id }: ValidationErrorMessageProps) {
  return (
    <p id={id} className="text-small text-danger" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {message}
    </p>
  )
}
