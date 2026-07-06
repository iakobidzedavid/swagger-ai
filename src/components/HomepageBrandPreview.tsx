'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

/**
 * Homepage domain-input widget (DE-18 revenue engine: closes the friction gap
 * for the "Self-serve PLG funnel" and "Organic search" acquisition channels —
 * supabase/migrations/0003_acquisition_channels.sql). Gives a visitor an
 * instant, read-only brand preview via /api/brand (no DB write) before they
 * commit to the full /onboard flow, which is where the record is persisted.
 */

type PreviewState = 'idle' | 'loading' | 'success' | 'error'

interface BrandPreview {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: string
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com',
])
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

function normalise(v: string) {
  return v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function formatValidate(domain: string): string | null {
  if (!domain) {return null}
  if (PERSONAL_DOMAINS.has(domain)) {return 'Enter a company domain, not a personal email provider'}
  if (!DOMAIN_RE.test(domain)) {return 'Enter a valid domain (e.g., acme.com)'}
  return null
}

export default function HomepageBrandPreview() {
  const router = useRouter()
  const [domain, setDomain] = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [state, setState] = useState<PreviewState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandPreview | null>(null)
  const [logoError, setLogoError] = useState(false)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDomain(raw)
    setBrand(null)
    setLogoError(false)
    setState('idle')
    setError(null)
    setFormatError(formatValidate(normalise(raw)))
  }, [])

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    const norm = normalise(domain)
    const err = formatValidate(norm)
    if (err || !norm) {
      setFormatError(err)
      return
    }

    setState('loading')
    setError(null)
    setBrand(null)

    try {
      const res = await fetch(`/api/brand?domain=${encodeURIComponent(norm)}`)
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setError(data.error ?? 'Could not look up that domain')
        return
      }
      setBrand(data)
      setState('success')
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  function handleContinue() {
    if (!brand) {return}
    router.push(`/onboard?domain=${encodeURIComponent(brand.domain)}`)
  }

  const isLoading = state === 'loading'

  return (
    <div className="card" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
      <form onSubmit={handlePreview} noValidate>
        <label htmlFor="homepage-domain-input" style={{ display: 'block', marginBottom: '8px' }}>
          <span className="text-small font-semibold">See your brand, instantly</span>
        </label>
        <div className="input-wrapper" style={{ marginBottom: '8px' }}>
          <input
            id="homepage-domain-input"
            type="text"
            className={`input-field${formatError ? ' input-error' : ''}`}
            placeholder="acme.com"
            value={domain}
            onChange={handleChange}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isLoading}
            aria-describedby={formatError ? 'homepage-domain-error' : undefined}
          />
        </div>

        {formatError && (
          <p id="homepage-domain-error" className="text-small text-danger" style={{ marginBottom: '12px' }}>
            {formatError}
          </p>
        )}

        {error && (
          <div className="error-banner" style={{ marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || !domain}>
          {isLoading ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16 }} />
              Fetching brand…
            </>
          ) : (
            'Preview my brand'
          )}
        </button>
      </form>

      {brand && state === 'success' && (
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center" style={{ gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{
              width: '56px', height: '56px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}>
              {brand.logoUrl && !logoError ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.companyName} logo`}
                  style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: brand.primaryColor }}>
                  {brand.companyName.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="text-h2" style={{ fontSize: '1.1rem' }}>{brand.companyName}</div>
              <div className="text-small text-muted">{brand.domain}</div>
            </div>
          </div>

          <div style={{
            height: '6px', borderRadius: '3px',
            background: `linear-gradient(to right, ${brand.primaryColor} 0%, ${brand.secondaryColor} 100%)`,
            marginBottom: '16px',
          }} />

          <button type="button" className="btn btn-primary btn-full" onClick={handleContinue}>
            Generate my store
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
