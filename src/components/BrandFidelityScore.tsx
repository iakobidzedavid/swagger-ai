'use client'

import { useEffect, useState } from 'react'

interface BrandFidelityScoreProps {
  domain: string
}

interface ScoreData {
  responseCount: number
  brandAccuracyPct: number | null
  reorderRatePct: number | null
}

/**
 * Surfaces Swagger AI's core (DE Step 10) directly to the buyer: a live score
 * computed from real employee feedback on prior orders for this storefront —
 * the proprietary outcome dataset the design engine compounds with every order.
 * Shows an honest empty state when no feedback has been captured yet.
 */
export function BrandFidelityScore({ domain }: BrandFidelityScoreProps) {
  const [data, setData] = useState<ScoreData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/design-feedback/score?domain=${encodeURIComponent(domain)}`)
      .then(res => res.json())
      .then(json => {
        if (!cancelled && json.success) {
          setData({
            responseCount: json.responseCount,
            brandAccuracyPct: json.brandAccuracyPct,
            reorderRatePct: json.reorderRatePct,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [domain])

  if (!data) return null

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 'var(--radius-md)',
    marginTop: '20px',
  }

  if (data.responseCount === 0) {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: '16px' }}>🧵</span>
        <span style={{ fontSize: '13px', opacity: 0.9 }}>
          New storefront — be the first to rate the brand match after your order
        </span>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <span style={{ fontSize: '16px' }}>🧵</span>
      <span style={{ fontSize: '14px', fontWeight: 700 }}>
        {data.brandAccuracyPct}% Brand Fidelity Score
      </span>
      <span style={{ fontSize: '13px', opacity: 0.85 }}>
        · {data.reorderRatePct}% would reorder · from {data.responseCount} real employee rating
        {data.responseCount === 1 ? '' : 's'}
      </span>
    </div>
  )
}
