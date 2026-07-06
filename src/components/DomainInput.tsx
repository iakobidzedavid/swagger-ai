'use client'

import { useState, useCallback, useRef, ReactNode } from 'react'

import { DOMAIN_RE, normalizeDomain } from '@/lib/brand'

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'unavailable'

interface DomainInputProps {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (state: ValidationState, reason?: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  required?: boolean
  showHelperText?: boolean
  onBlur?: () => void
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
  'googlemail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
])

/**
 * Validates domain format without network calls.
 * Returns null if valid, or an error message if invalid.
 */
function validateFormatOnly(domain: string): string | null {
  if (!domain) {return null}
  if (PERSONAL_DOMAINS.has(domain)) {return 'Enter a company domain, not a personal email provider'}
  if (!DOMAIN_RE.test(domain)) {return 'Enter a valid domain (e.g., acme.com)'}
  return null
}

/**
 * Calls the validation API to check domain reachability.
 */
async function validateViaApi(normalizedDomain: string): Promise<{
  valid: boolean
  reason?: string
}> {
  try {
    const res = await fetch(`/api/domain/validate?domain=${encodeURIComponent(normalizedDomain)}`)
    return await res.json()
  } catch {
    // Network error — allow submit anyway (fail gracefully)
    return { valid: true }
  }
}

/**
 * Enhanced domain input component with validation and error handling.
 * Provides real-time format validation, debounced API validation, and clear feedback.
 */
export function DomainInput({
  value,
  onChange,
  onValidationChange,
  placeholder = 'acme.com',
  disabled = false,
  autoFocus = false,
  required = true,
  showHelperText = true,
  onBlur: onBlurProp,
}: DomainInputProps) {
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Format validation (synchronous)
  const norm = normalizeDomain(value)
  const formatError = validateFormatOnly(norm)

  // Notify parent of validation state changes
  const updateValidationState = useCallback((newState: ValidationState, reason?: string) => {
    setValidationState(newState)
    if (onValidationChange) {
      onValidationChange(newState, reason)
    }
  }, [onValidationChange])

  // Debounced API validation
  const runApiValidation = useCallback(async (normalizedDomain: string) => {
    updateValidationState('validating')
    setValidationMsg(null)
    const data = await validateViaApi(normalizedDomain)
    if (data.valid) {
      updateValidationState('valid')
      setValidationMsg(null)
    } else {
      updateValidationState('unavailable')
      setValidationMsg(
        data.reason ||
        `${normalizedDomain} could not be verified. It may be unreachable, or still initializing.`
      )
    }
  }, [updateValidationState])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    onChange(raw)

    const newNorm = normalizeDomain(raw)
    const err = validateFormatOnly(newNorm)
    setValidationMsg(null)

    if (err || !newNorm) {
      updateValidationState('idle')
      return
    }

    // Debounce API validation
    if (validateTimer.current) {clearTimeout(validateTimer.current)}
    validateTimer.current = setTimeout(() => runApiValidation(newNorm), 400)
  }, [onChange, updateValidationState, runApiValidation])

  const handleBlur = useCallback(() => {
    if (validateTimer.current) {clearTimeout(validateTimer.current)}
    const newNorm = normalizeDomain(value)
    const err = validateFormatOnly(newNorm)
    if (!err && newNorm && validationState === 'idle') {
      runApiValidation(newNorm)
    }
    onBlurProp?.()
  }, [value, validationState, runApiValidation, onBlurProp])

  const isError = formatError || validationState === 'unavailable'
  const isValid = validationState === 'valid'
  const isValidating = validationState === 'validating'

  return (
    <div>
      <div className="input-wrapper" style={{ marginBottom: '8px' }}>
        <input
          type="text"
          className={`input-field${isValid ? ' input-valid' : isError ? ' input-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={isError || validationMsg ? 'domain-input-error' : undefined}
          aria-invalid={isError ? 'true' : 'false'}
          data-validating={isValidating}
        />
        <span className="input-suffix">
          {isValidating && (
            <span className="spinner" aria-label="Validating domain…" title="Checking domain availability" />
          )}
          {isValid && (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-label="Domain valid">
              <circle cx="9" cy="9" r="8" stroke="var(--color-success)" strokeWidth="1.5" />
              <path d="M5.5 9l2.5 2.5 4.5-5" stroke="var(--color-success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {isError && value && (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-label="Domain invalid">
              <circle cx="9" cy="9" r="8" stroke="var(--color-danger)" strokeWidth="1.5" />
              <path d="M9 5v5M9 12.5v.5" stroke="var(--color-danger)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </span>
      </div>

      {/* Error message */}
      {(formatError || validationMsg) && (
        <p id="domain-input-error" className="text-small text-danger" style={{ marginBottom: '12px' }}>
          {formatError || validationMsg}
        </p>
      )}

      {/* Helper text */}
      {showHelperText && !formatError && !validationMsg && value && (
        <p className="text-small text-muted" style={{ marginBottom: '12px' }}>
          e.g. linear.app, ramp.com, retool.com
        </p>
      )}
    </div>
  )
}
