'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

import { CompetitivePositionChart } from '@/components/CompetitivePositionChart'

interface StorefrontRequest {
  id: string
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  status: string
  created_at: string
  generation_seconds: number | null
  brand_fidelity_pct: number | null
}

interface StoreInfo {
  id: string
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  storeUrl: string
  createdAt: string
  generationSeconds: number | null
  brandFidelityPct: number | null
}

function StoreCreatedContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams.get('id') || ''

  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchStoreInfo() {
      if (!requestId) {
        setError('No store request ID provided')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/storefront/fetch?id=${encodeURIComponent(requestId)}`)
        if (!res.ok) {
          setError('Failed to load store information')
          setLoading(false)
          return
        }
        const data: StorefrontRequest = await res.json()

        // Generate store URL pointing to the real storefront page (not a fake domain)
        // The domain is guaranteed to contain only alphanumerics, hyphens, and dots (via validation)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        const storeUrl = `${appUrl}/storefront/${data.domain}`

        setStoreInfo({
          id: data.id,
          domain: data.domain,
          companyName: data.company_name || data.domain.split('.')[0].charAt(0).toUpperCase() + data.domain.split('.')[0].slice(1),
          logoUrl: data.logo_url,
          primaryColor: data.primary_color,
          secondaryColor: data.secondary_color,
          storeUrl,
          createdAt: data.created_at,
          generationSeconds: data.generation_seconds,
          brandFidelityPct: data.brand_fidelity_pct,
        })
        setError(null)
      } catch (err) {
        console.error('Error fetching store info:', err)
        setError('Failed to load store information')
      } finally {
        setLoading(false)
      }
    }

    fetchStoreInfo()
  }, [requestId])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="section">
        <div className="container content-narrow" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !storeInfo) {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {error || 'No store information available'}
          </div>
          <a href="/onboard" className="btn btn-secondary btn-full">
            Create Another Store
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="container content-narrow">
        {/* Success Banner */}
        <div className="success-banner" style={{ marginBottom: '32px' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Store request created successfully!
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Your Swag Store is on the Way! 🎉
          </h1>
          <p className="text-body text-muted">
            We're setting up your branded storefront. You'll receive a confirmation email shortly with your store link.
          </p>
        </div>

        {/* Store Details Card */}
        <div className="card" style={{ marginBottom: '32px', borderColor: storeInfo.primaryColor, borderWidth: '1px' }}>
          <div style={{ marginBottom: '24px' }}>
            {/* Logo and Company Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                width: '80px', height: '80px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {storeInfo.logoUrl ? (
                  <img
                    src={storeInfo.logoUrl}
                    alt={`${storeInfo.companyName} logo`}
                    style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: storeInfo.primaryColor }}>
                    {storeInfo.companyName.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <div className="text-h2">{storeInfo.companyName}</div>
                <div className="text-small text-muted">{storeInfo.domain}</div>
              </div>
            </div>

            <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
              Store Configuration
            </div>

            {/* Brand Colors */}
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                Brand Colors
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '40px', height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: storeInfo.primaryColor,
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <div>
                    <div className="text-small text-muted">Primary</div>
                    <code style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{storeInfo.primaryColor}</code>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '40px', height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: storeInfo.secondaryColor,
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <div>
                    <div className="text-small text-muted">Secondary</div>
                    <code style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{storeInfo.secondaryColor}</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Store URL */}
            <div>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Store URL
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <code style={{ flex: 1, fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {storeInfo.storeUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(storeInfo.storeUrl)}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-accent)'
                    ;(e.target as HTMLElement).style.color = 'var(--color-on-accent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.target as HTMLElement).style.background = 'transparent'
                    ;(e.target as HTMLElement).style.color = 'var(--color-accent)'
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Your Competitive Position — DE Step 11 made real: your own generation
            time + brand-fidelity score, plotted against the competitive research */}
        {storeInfo.generationSeconds !== null && storeInfo.brandFidelityPct !== null && (
          <CompetitivePositionChart
            yourSpeedSeconds={storeInfo.generationSeconds}
            yourBrandFidelityPct={storeInfo.brandFidelityPct}
          />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <a
            href={storeInfo.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-full"
          >
            View Store
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6H6v4h4v-4zM2 8h2M12 8h2M8 2v2M8 12v2" />
            </svg>
          </a>
          <button
            onClick={() => copyToClipboard(storeInfo.storeUrl)}
            className="btn btn-secondary btn-full"
          >
            Share Link
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 13.5h-2a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
              <path d="M10 3.5L13.5 7M10 3.5l3.5-3.5" />
            </svg>
          </button>
        </div>

        {/* Next Steps */}
        <div className="card" style={{ marginBottom: '24px', background: 'var(--color-surface)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="text-h3" style={{ marginBottom: '12px' }}>
              Next Steps
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Share with your team</strong> — Copy the store link and share it in Slack or via email
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Monitor orders</strong> — Check your admin dashboard for real-time order tracking
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Customize anytime</strong> — Add products, adjust colors, or create a new store from the dashboard
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Return Home Button */}
        <a href="/" className="btn btn-secondary btn-full">
          Return to Home
        </a>
      </div>
    </div>
  )
}

export default function StoreCreatedPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <StoreCreatedContent />
    </Suspense>
  )
}
