'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect, Suspense } from 'react'

import { BrandAssetGallery } from '@/components/BrandAssetGallery'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSkeleton, LoadingOverlay } from '@/components/LoadingSkeleton'
import { ErrorRecovery, ValidationErrorMessage } from '@/components/ErrorRecovery'
import { captureAttribution, getAttribution } from '@/lib/attribution'
import { DOMAIN_RE, normalizeDomain } from '@/lib/brand'

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'
type StoreRequestState = 'idle' | 'requesting' | 'queued' | 'error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface BrandResult {
  id: string
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  status: string
  created_at: string
}

interface BrandPreview {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  colors?: string[]
  fonts?: string[]
  raw?: Record<string, unknown>
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com',
])

function formatValidate(domain: string): string | null {
  if (!domain) {return null}
  if (PERSONAL_DOMAINS.has(domain)) {return 'Enter a company domain, not a personal email provider'}
  if (!DOMAIN_RE.test(domain)) {return 'Enter a valid domain (e.g., acme.com)'}
  return null
}

function OnboardForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [domain, setDomain] = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandResult | null>(null)
  const [brandPreview, setBrandPreview] = useState<BrandPreview | null>(null)
  const [previewFetchState, setPreviewFetchState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [storeRequestState, setStoreRequestState] = useState<StoreRequestState>('idle')
  const [storeRequestId, setStoreRequestId] = useState<string | null>(null)
  const [storeRequestError, setStoreRequestError] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [secondaryColor, setSecondaryColor] = useState<string | null>(null)
  const [userSelectedSecondaryColor, setUserSelectedSecondaryColor] = useState<string | null>(null)
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // First-touch acquisition-channel attribution (DE-18 revenue engine): capture
  // once on landing so a domain submitted directly on /onboard (e.g. via a
  // ?utm_source= channel link) is still attributed, not just homepage entries.
  useEffect(() => {
    captureAttribution()
  }, [])

  // Prefill from ?domain= (the homepage brand-preview widget hands off here
  // via /onboard?domain=<domain> so the visitor doesn't retype it — DE-18).
  useEffect(() => {
    const fromQuery = searchParams.get('domain')
    if (!fromQuery) {return}
    const norm = normalizeDomain(fromQuery)
    if (!norm || formatValidate(norm)) {return}
    setDomain(norm)
    runApiValidation(norm)
     
  }, [searchParams])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const copyHex = async (color: string) => {
    try {
      await navigator.clipboard.writeText(color)
      showToast(`Copied ${color}`)
    } catch {
      showToast(color)
    }
  }

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setContactEmail(v)
    if (v && !EMAIL_RE.test(v)) {
      setEmailError('Enter a valid email address')
    } else {
      setEmailError(null)
    }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDomain(raw)
    setBrand(null)
    setBrandPreview(null)
    setLogoError(false)
    setSubmitState('idle')
    setSubmitError(null)
    setPreviewFetchState('idle')
    setPrimaryColor(null)
    setSecondaryColor(null)
    setUserSelectedSecondaryColor(null)

    const norm = normalizeDomain(raw)
    const err = formatValidate(norm)
    setFormatError(err)

    if (err || !norm) {
      setValidationState('idle')
      setValidationMsg(null)
    }

    // Debounce API validation
    if (validateTimer.current) {clearTimeout(validateTimer.current)}
    if (!err && norm) {
      validateTimer.current = setTimeout(() => runApiValidation(norm), 300)
    }
  }, [])

  const handleBlur = useCallback(() => {
    if (validateTimer.current) {clearTimeout(validateTimer.current)}
    const norm = normalizeDomain(domain)
    const err = formatValidate(norm)
    if (!err && norm && validationState === 'idle') {
      runApiValidation(norm)
    }
  }, [domain, validationState])

  async function runApiValidation(norm: string) {
    setValidationState('validating')
    setValidationMsg(null)
    try {
      const res = await fetch(`/api/domain/validate?domain=${encodeURIComponent(norm)}`)
      const data = await res.json()
      if (data.valid) {
        setValidationState('valid')
        setValidationMsg(null)
      } else {
        setValidationState('invalid')
        setValidationMsg(data.reason ?? 'Domain could not be verified')
      }
    } catch {
      // Network error — allow submit anyway (fail gracefully)
      setValidationState('valid')
    }
  }

  async function handleGenerateStore(brandOverride?: BrandResult) {
    const brandData = brandOverride ?? brand
    if (!brandData) {return}
    setStoreRequestState('requesting')
    setStoreRequestError(null)
    try {
      const res = await fetch('/api/storefront/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_submission_id: brandData.id,
          domain: brandData.domain,
          company_name: brandData.company_name,
          logo_url: brandData.logo_url,
          primary_color: brandData.primary_color,
          secondary_color: userSelectedSecondaryColor || brandData.secondary_color,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStoreRequestState('error')
        setStoreRequestError(data.error ?? 'Failed to queue store request')
        return
      }
      setStoreRequestId(data.id)
      setStoreRequestState('queued')
      // Redirect to store-created page with the request ID
      setTimeout(() => {
        router.push(`/store-created?id=${encodeURIComponent(data.id)}`)
      }, 500)
    } catch {
      setStoreRequestState('error')
      setStoreRequestError('Network error. Please try again.')
    }
  }

  async function fetchBrandPreview(norm: string) {
    setPreviewFetchState('loading')
    const startTime = Date.now()
    try {
      const res = await fetch(`/api/brand?domain=${encodeURIComponent(norm)}`)
      const data = await res.json()
      if (!res.ok) {
        setPreviewFetchState('error')
        return
      }
      // Ensure loading state is visible for at least 500ms
      const elapsed = Date.now() - startTime
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed))
      }
      setBrandPreview(data)
      setPrimaryColor(data.primaryColor)
      setSecondaryColor(data.secondaryColor)
      setPreviewFetchState('loaded')
    } catch {
      setPreviewFetchState('error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const norm = normalizeDomain(domain)
    const err = formatValidate(norm)
    if (err || !norm) {return}
    if (emailError) {return}

    // If we don't have a preview yet, fetch it first
    if (!brandPreview) {
      await fetchBrandPreview(norm)
      return
    }

    // We have a preview, now persist to Supabase
    setSubmitState('submitting')
    setSubmitError(null)
    setBrand(null)
    setLogoError(false)

    try {
      const res = await fetch('/api/domain/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: norm,
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          ...getAttribution(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitState('error')
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setBrand(data)
      setSubmitState('success')
      // Single click, single flow: the domain form's CTA reads "Continue to
      // Store", so continuing to the store — firing the storefront request
      // and landing on /store-created — must happen right here, not wait on
      // a second manual click the visitor has no reason to expect.
      handleGenerateStore(data)
    } catch {
      setSubmitState('error')
      setSubmitError('Network error. Please check your connection and try again.')
    }
  }

  const norm = normalizeDomain(domain)
  const fmtErr = formatValidate(norm)
  const canSubmit = Boolean(norm) && !fmtErr && !emailError && validationState !== 'invalid' && submitState !== 'submitting'
  const isSubmitting = submitState === 'submitting'

  return (
    <div className="section">
      <div className="container content-narrow">

        {/* Progress */}
        <div style={{ marginBottom: '40px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <span className="text-small text-muted">
              {storeRequestState === 'queued' ? 'Step 3 of 3' : submitState === 'success' ? 'Step 2 of 3' : 'Step 1 of 3'}
            </span>
            <span className="text-small text-muted">
              {storeRequestState === 'queued' ? 'Store Queued' : submitState === 'success' ? 'Generate Store' : 'Brand Detection'}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: storeRequestState === 'queued' ? '100%' : submitState === 'success' ? '66%' : '33%' }} />
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            {storeRequestState === 'queued' ? 'Your store is queued!' : submitState === 'success' ? 'Brand detected!' : 'Let’s get your brand'}
          </h1>
          <p className="text-body text-muted">
            {storeRequestState === 'queued'
              ? 'Your branded swag storefront is being configured. We\'ll reach out with a personalized preview.'
              : submitState === 'success'
              ? 'Review your brand colors and logo, then generate your swag storefront.'
              : 'Enter your company domain to auto-fetch your brand colors and logo.'}
          </p>
        </div>

        {/* Domain Input Form */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="contact-name" style={{ display: 'block', marginBottom: '6px' }}>
                  <span className="text-small font-semibold">Your Name</span>
                  <span className="text-small text-muted" style={{ marginLeft: '6px' }}>(optional)</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  className="input-field"
                  placeholder="Maya Chen"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  autoComplete="name"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="contact-email" style={{ display: 'block', marginBottom: '6px' }}>
                  <span className="text-small font-semibold">Work Email</span>
                  <span className="text-small text-muted" style={{ marginLeft: '6px' }}>(optional)</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className={`input-field${emailError ? ' input-error' : ''}`}
                  placeholder="maya@acme.com"
                  value={contactEmail}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  disabled={isSubmitting}
                />
                {emailError && (
                  <p className="text-small text-danger" style={{ marginTop: '4px' }}>{emailError}</p>
                )}
              </div>
            </div>

            <label htmlFor="domain-input" style={{ display: 'block', marginBottom: '8px' }}>
              <span className="text-small font-semibold">Company Domain</span>
            </label>

            <div className="input-wrapper" style={{ marginBottom: '8px' }}>
              <input
                id="domain-input"
                type="text"
                className={`input-field${
                  validationState === 'valid' ? ' input-valid' :
                  (fmtErr || validationState === 'invalid') ? ' input-error' : ''
                }`}
                placeholder="acme.com"
                value={domain}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isSubmitting}
                aria-describedby={fmtErr || validationMsg ? 'domain-error' : undefined}
              />
              <span className="input-suffix">
                {validationState === 'validating' && (
                  <span className="spinner" aria-label="Validating…" />
                )}
                {validationState === 'valid' && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" stroke="var(--color-success)" strokeWidth="1.5"/>
                    <path d="M5.5 9l2.5 2.5 4.5-5" stroke="var(--color-success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {(fmtErr || validationState === 'invalid') && domain && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" stroke="var(--color-danger)" strokeWidth="1.5"/>
                    <path d="M9 5v5M9 12.5v.5" stroke="var(--color-danger)" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </span>
            </div>

            {/* Format validation error */}
            {fmtErr && (
              <p id="domain-error" className="text-small text-danger" style={{ marginBottom: '12px' }}>
                {fmtErr}
              </p>
            )}

            {/* API validation error with recovery options */}
            {!fmtErr && validationMsg && (
              <div style={{ marginBottom: '16px' }}>
                <ErrorRecovery
                  error={validationMsg}
                  title="Domain verification failed"
                  icon="validation"
                  actions={[
                    {
                      label: 'Try Again',
                      onClick: () => {
                        const norm = normalizeDomain(domain)
                        if (norm) {
                          runApiValidation(norm)
                        }
                      },
                      primary: true,
                    },
                    {
                      label: 'Clear',
                      onClick: () => {
                        setDomain('')
                        setValidationMsg(null)
                        setValidationState('idle')
                      },
                    },
                  ]}
                />
              </div>
            )}

            {!fmtErr && !validationMsg && domain && (
              <p className="text-small text-muted" style={{ marginBottom: '12px' }}>
                e.g. linear.app, ramp.com, retool.com
              </p>
            )}

            {submitError && (
              <div style={{ marginBottom: '16px' }}>
                <ErrorRecovery
                  error={submitError}
                  title="Could not detect brand"
                  icon="server"
                  actions={[
                    {
                      label: 'Try Again',
                      onClick: () => {
                        setSubmitError(null)
                        setBrandPreview(null)
                        setSubmitState('idle')
                      },
                      primary: true,
                    },
                  ]}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={!canSubmit || previewFetchState === 'loading' || isSubmitting}
              style={{ marginTop: fmtErr || validationMsg ? 0 : undefined }}
            >
              {previewFetchState === 'loading' || isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  {isSubmitting ? 'Saving…' : 'Fetching brand assets…'}
                </>
              ) : brandPreview ? (
                <>
                  Continue to Store
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </>
              ) : (
                <>
                  Fetch Brand &amp; Preview
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Brand Preview Gallery */}
        {(brandPreview || previewFetchState === 'loading' || previewFetchState === 'error') && !brand && (
          <div className="card" style={{ marginBottom: '24px', borderColor: 'var(--color-accent)', borderWidth: '1px' }}>
            {previewFetchState === 'loading' ? (
              <LoadingSkeleton type="gallery" />
            ) : previewFetchState === 'error' ? (
              <ErrorRecovery
                error="Could not load brand assets. Please check the domain and try again."
                title="Brand Load Failed"
                icon="network"
                actions={[
                  {
                    label: 'Retry',
                    onClick: () => {
                      const norm = normalizeDomain(domain)
                      if (norm) {
                        fetchBrandPreview(norm)
                      }
                    },
                    primary: true,
                  },
                  {
                    label: 'Clear',
                    onClick: () => {
                      setBrandPreview(null)
                      setPreviewFetchState('idle')
                      setSubmitState('idle')
                      setSubmitError(null)
                    },
                  },
                ]}
              />
            ) : previewFetchState === 'loaded' && brandPreview ? (
              <BrandAssetGallery
                assets={{
                  domain: brandPreview.domain,
                  companyName: brandPreview.companyName,
                  logoUrl: brandPreview.logoUrl,
                  primaryColor: brandPreview.primaryColor,
                  secondaryColor: brandPreview.secondaryColor,
                  colors: brandPreview.colors,
                  fonts: brandPreview.fonts,
                }}
                logoError={logoError}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                userSelectedSecondaryColor={userSelectedSecondaryColor}
                onColorSelect={setPrimaryColor}
                onSecondaryColorChange={setUserSelectedSecondaryColor}
              />
            ) : null}
          </div>
        )}

        {/* Brand Saved (after submit) */}
        {brand && submitState === 'success' && (
          <div className="card" style={{ borderColor: 'var(--color-accent)', borderWidth: '1px' }}>
            <div className="success-banner" style={{ marginBottom: '24px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Brand detected and saved — ID {brand.id.slice(0, 8)}…
            </div>

            <BrandAssetGallery
              assets={{
                domain: brand.domain,
                companyName: brand.company_name,
                logoUrl: brand.logo_url,
                primaryColor: brand.primary_color,
                secondaryColor: brand.secondary_color,
              }}
              logoError={logoError}
              userSelectedSecondaryColor={userSelectedSecondaryColor}
              onLogoError={setLogoError}
            />

            {/* Store request error */}
            {storeRequestError && (
              <div style={{ marginBottom: '16px' }}>
                <ErrorRecovery
                  error={storeRequestError}
                  title="Store creation failed"
                  icon="server"
                  actions={[
                    {
                      label: 'Retry',
                      onClick: () => handleGenerateStore(),
                      primary: true,
                    },
                    {
                      label: 'Cancel',
                      onClick: () => {
                        setStoreRequestError(null)
                        setStoreRequestState('idle')
                      },
                    },
                  ]}
                />
              </div>
            )}

            {/* Queued confirmation */}
            {storeRequestState === 'queued' && storeRequestId && (
              <div className="success-banner" style={{ marginBottom: '20px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Store queued — request ID {storeRequestId.slice(0, 8)}…
              </div>
            )}

            {storeRequestState !== 'queued' && (
              <button
                type="button"
                onClick={() => handleGenerateStore()}
                disabled={storeRequestState === 'requesting'}
                className="btn btn-primary btn-full"
                style={{ marginTop: '8px', marginBottom: '16px' }}
              >
                {storeRequestState === 'requesting' ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                    Creating your store…
                  </>
                ) : (
                  <>
                    Generate My Store
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
              <div className="text-small text-muted">
                Saved to Swagger AI · {new Date(brand.created_at).toLocaleString()}
              </div>
              <div className="flex" style={{ gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={`/design/recommendations?domain=${encodeURIComponent(brand.domain)}`}
                  className="btn btn-secondary btn-sm"
                >
                  View Design Kit
                </a>
                <a href="/onboard" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); setBrand(null); setDomain(''); setValidationState('idle'); setSubmitState('idle'); setStoreRequestState('idle'); setStoreRequestId(null); }}>
                  Try another domain
                </a>
                <a
                  href={`/products?domain=${encodeURIComponent(brand.domain)}&id=${encodeURIComponent(brand.id)}`}
                  className="btn btn-secondary btn-sm"
                >
                  Select Products Instead
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Loading overlay for store creation */}
      <LoadingOverlay
        visible={storeRequestState === 'requesting' || storeRequestState === 'queued'}
        message={
          storeRequestState === 'requesting'
            ? 'Creating your branded store...'
            : 'Processing your store request...'
        }
      />
    </div>
  )
}

export default function OnboardPage() {
  // useSearchParams requires a Suspense boundary during static generation.
  // Wrap in ErrorBoundary to gracefully handle any runtime errors
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <OnboardForm />
      </Suspense>
    </ErrorBoundary>
  )
}
