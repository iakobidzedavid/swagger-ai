'use client'

import { useState, useRef, useCallback } from 'react'
import { DOMAIN_RE, normalizeDomain } from '@/lib/brand'

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'
type FetchState = 'idle' | 'fetching' | 'success' | 'error'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
])

interface BrandData {
  id: string
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  status: string
  created_at: string
  brand_source?: string
  color_count?: number
  font_count?: number
  raw_brand_data?: {
    source?: string
    colors?: string[]
    fonts?: string[]
    brandfetchId?: string
    brandfetchModified?: string
    colorCount?: number
    fontCount?: number
    [key: string]: unknown
  }
}

function formatValidate(domain: string): string | null {
  if (!domain) return null
  if (PERSONAL_DOMAINS.has(domain)) return 'Enter a company domain, not a personal email provider'
  if (!DOMAIN_RE.test(domain)) return 'Enter a valid domain (e.g., acme.com)'
  return null
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" style={{ gap: '10px', padding: '8px 0' }}>
      <div
        style={{
          background: color,
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      />
      <div>
        <div className="text-small text-muted" style={{ fontSize: '0.75rem' }}>{label}</div>
        <div className="text-small font-semibold" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{color}</div>
      </div>
    </div>
  )
}

export default function BrandfetchAdminPage() {
  const [domain, setDomain] = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandData | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [searchHistory, setSearchHistory] = useState<BrandData[]>([])
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDomain(raw)
    setBrand(null)
    setFetchState('idle')
    setFetchError(null)

    const norm = normalizeDomain(raw)
    const err = formatValidate(norm)
    setFormatError(err)

    if (err || !norm) {
      setValidationState('idle')
      setValidationMsg(null)
    }

    if (validateTimer.current) clearTimeout(validateTimer.current)
    if (!err && norm) {
      validateTimer.current = setTimeout(() => runApiValidation(norm), 300)
    }
  }, [])

  const handleBlur = useCallback(() => {
    if (validateTimer.current) clearTimeout(validateTimer.current)
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
      setValidationState('valid')
    }
  }

  async function handleFetchBrand(e: React.FormEvent) {
    e.preventDefault()
    const norm = normalizeDomain(domain)
    const err = formatValidate(norm)
    if (err || !norm) return

    setFetchState('fetching')
    setFetchError(null)
    setBrand(null)

    try {
      const res = await fetch('/api/domain/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: norm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFetchState('error')
        setFetchError(data.error ?? 'Failed to fetch brand data')
        return
      }
      setBrand(data)
      setFetchState('success')
      setSearchHistory([data, ...searchHistory.slice(0, 9)])
      setDomain('')
      setValidationState('idle')
    } catch {
      setFetchState('error')
      setFetchError('Network error. Please check your connection.')
    }
  }

  const norm = normalizeDomain(domain)
  const fmtErr = formatValidate(norm)
  const canFetch = !!norm && !fmtErr && validationState !== 'invalid' && fetchState !== 'fetching'

  return (
    <div className="section">
      <div className="container content-narrow">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '8px' }}>
            Brand Research Tool
          </h1>
          <p className="text-body text-muted">
            Look up company brands via Brandfetch API to research acquisition channels and target accounts.
          </p>
        </div>

        {/* Search form */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <form onSubmit={handleFetchBrand} noValidate>
            <label htmlFor="domain-search" style={{ display: 'block', marginBottom: '12px' }}>
              <span className="text-small font-semibold">Company Domain</span>
            </label>

            <div className="input-wrapper" style={{ marginBottom: '12px' }}>
              <input
                id="domain-search"
                type="text"
                className={`input-field${
                  validationState === 'valid' ? ' input-valid' :
                  (fmtErr || validationState === 'invalid') ? ' input-error' : ''
                }`}
                placeholder="e.g., vanta.com, ramp.com, linear.app"
                value={domain}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={fetchState === 'fetching'}
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
              </span>
            </div>

            {(fmtErr || validationMsg) && (
              <p id="domain-error" className="text-small text-danger" style={{ marginBottom: '12px' }}>
                {fmtErr || validationMsg}
              </p>
            )}

            {fetchError && (
              <div className="error-banner" style={{ marginBottom: '16px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                {fetchError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={!canFetch}
            >
              {fetchState === 'fetching' ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Fetching brand data…
                </>
              ) : (
                'Fetch Brand Data'
              )}
            </button>
          </form>
        </div>

        {/* Brand result */}
        {brand && fetchState === 'success' && (
          <div className="card" style={{ marginBottom: '32px', borderColor: 'var(--color-accent)', borderWidth: '1px' }}>
            <div className="success-banner" style={{ marginBottom: '24px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Brand data fetched successfully
            </div>

            {/* Logo and name */}
            <div className="flex items-center" style={{ gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{
                width: '80px', height: '80px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {brand.logo_url && !logoError ? (
                  <img
                    src={brand.logo_url}
                    alt={`${brand.company_name} logo`}
                    style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: brand.primary_color }}>
                    {brand.company_name.charAt(0)}
                  </span>
                )}
              </div>

              <div>
                <div className="text-h2">{brand.company_name}</div>
                <div className="text-small text-muted">{brand.domain}</div>
              </div>
            </div>

            {/* Colors */}
            <div style={{ marginBottom: '24px' }}>
              <div className="text-small font-semibold" style={{ marginBottom: '16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                Brand Colors
              </div>
              <div style={{ marginBottom: '16px' }}>
                <ColorSwatch color={brand.primary_color} label="Primary" />
                <ColorSwatch color={brand.secondary_color} label="Secondary" />
              </div>

              {/* Gradient preview */}
              <div style={{
                height: '8px', borderRadius: '4px',
                background: `linear-gradient(to right, ${brand.primary_color} 0%, ${brand.secondary_color} 100%)`,
                marginBottom: '16px',
              }} />

              {/* Full color palette from Brandfetch */}
              {brand.raw_brand_data?.colors && brand.raw_brand_data.colors.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                  <div className="text-small text-muted" style={{ marginBottom: '8px', fontSize: '0.75rem' }}>
                    Full Palette ({brand.raw_brand_data.colors.length})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {brand.raw_brand_data.colors.map((color, i) => (
                      <div key={i} title={color} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '28px', height: '28px',
                          borderRadius: '4px',
                          background: color,
                          border: '1px solid var(--color-border)',
                        }} />
                        <span className="text-small" style={{ fontSize: '0.75rem', fontFamily: 'monospace', minWidth: '70px' }}>
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fonts */}
            {brand.raw_brand_data?.fonts && brand.raw_brand_data.fonts.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div className="text-small font-semibold" style={{ marginBottom: '16px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                  Brand Fonts ({brand.raw_brand_data.fonts.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {brand.raw_brand_data.fonts.map((font, i) => (
                    <div key={i} style={{
                      padding: '12px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div className="text-small font-semibold">{font}</div>
                      <div style={{ fontFamily: font, fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        The quick brown fox
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '0.875rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div className="text-small text-muted">Record ID</div>
                  <div className="text-small font-semibold" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {brand.id.slice(0, 8)}…
                  </div>
                </div>
                <div>
                  <div className="text-small text-muted">Status</div>
                  <div className="text-small font-semibold">{brand.status}</div>
                </div>
                {brand.brand_source && (
                  <div>
                    <div className="text-small text-muted">Brand Source</div>
                    <div className="text-small font-semibold" style={{ textTransform: 'capitalize' }}>
                      {brand.brand_source === 'brandfetch' ? '🚀 Brandfetch API' : brand.brand_source}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-small text-muted">Fetched</div>
                  <div className="text-small font-semibold">
                    {new Date(brand.created_at).toLocaleString()}
                  </div>
                </div>
                {(brand.color_count || 0) > 0 && (
                  <div>
                    <div className="text-small text-muted">Color Palette</div>
                    <div className="text-small font-semibold">{brand.color_count} colors</div>
                  </div>
                )}
                {(brand.font_count || 0) > 0 && (
                  <div>
                    <div className="text-small text-muted">Brand Fonts</div>
                    <div className="text-small font-semibold">{brand.font_count} fonts</div>
                  </div>
                )}
                {brand.raw_brand_data?.brandfetchId && (
                  <div>
                    <div className="text-small text-muted">Brandfetch ID</div>
                    <div className="text-small font-semibold" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {brand.raw_brand_data.brandfetchId.slice(0, 8)}…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setBrand(null)
                  setDomain('')
                  setValidationState('idle')
                  setFetchState('idle')
                }}
              >
                Search another domain
              </button>
            </div>
          </div>
        )}

        {/* Search history */}
        {searchHistory.length > 0 && (
          <div>
            <h2 className="text-h2" style={{ marginBottom: '16px' }}>
              Recent searches ({searchHistory.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {searchHistory.map((b) => (
                <div key={b.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setBrand(b)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '48px', height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, overflow: 'hidden',
                    }}>
                      {b.logo_url ? (
                        <img
                          src={b.logo_url}
                          alt=""
                          style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: b.primary_color }}>
                          {b.company_name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-small font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.company_name}
                      </div>
                      <div className="text-small text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.domain}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: '4px', height: '24px', borderRadius: '4px', overflow: 'hidden',
                  }}>
                    <div style={{ flex: 1, background: b.primary_color }} />
                    <div style={{ flex: 1, background: b.secondary_color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
