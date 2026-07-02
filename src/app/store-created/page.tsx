'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface StoreInfo {
  domain: string
  companyName: string
  storeUrl: string
  productCount: number
}

function StoreCreatedContent() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''

  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // In a real scenario, you'd fetch store details from the API
    // For now, we'll create a mock store info based on the domain
    if (domain) {
      const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
      const storeUrl = `https://${domain.replace(/\./g, '-')}.swagger.shop`

      setStoreInfo({
        domain,
        companyName,
        storeUrl,
        productCount: 8,
      })
    }

    setLoading(false)
  }, [domain])

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

  if (!storeInfo) {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            No store information available
          </div>
          <a href="/" className="btn btn-secondary btn-full">
            Return Home
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
          Store created successfully!
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Your Swag Store is Live 🎉
          </h1>
          <p className="text-body text-muted">
            Your branded storefront has been created and is ready to share with your team.
          </p>
        </div>

        {/* Store Details Card */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
              Store Details
            </div>

            {/* Store Name */}
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Company
              </div>
              <div className="text-h2">{storeInfo.companyName}</div>
            </div>

            {/* Store URL */}
            <div style={{ marginBottom: '16px' }}>
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
                  }}
                  onMouseEnter={(e) => {
                    ;(e.target as HTMLElement).style.background = 'var(--color-accent)'
                    ;(e.target as HTMLElement).style.color = '#fff'
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

            {/* Product Count */}
            <div>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Products Available
              </div>
              <div className="text-h3">{storeInfo.productCount}</div>
            </div>
          </div>
        </div>

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
