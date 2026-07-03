'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'

interface StorefrontStat {
  id: string
  domain: string
  companyName: string
  status: string
  createdAt: string
  gmvCents: number
  gmvDisplay: string
  swaggerFeeCents: number
  swaggerFeeDisplay: string
  orderCount: number
}

interface DashboardData {
  storefronts: StorefrontStat[]
  totalGmvCents: number
  totalFeeCents: number
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

function DashboardContent() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoadingState('loading')
        // In production, get the actual auth token from NextAuth or Supabase session
        // For now, use a placeholder token
        const token = localStorage.getItem('supabase_auth_token') || 'placeholder'

        const res = await fetch('/api/dashboard/storefronts', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!res.ok) {
          setError('Failed to load dashboard')
          setLoadingState('error')
          return
        }

        const data = await res.json()
        setDashboardData(data)
        setLoadingState('loaded')
      } catch (err) {
        console.error('Dashboard error:', err)
        setError('Failed to load dashboard')
        setLoadingState('error')
      }
    }

    fetchDashboard()
  }, [])

  if (loadingState === 'loading') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="text-center">
          <p className="text-muted">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (loadingState === 'error') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      </div>
    )
  }

  if (!dashboardData || dashboardData.storefronts.length === 0) {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="text-center">
          <h2 className="text-h2" style={{ marginBottom: '16px' }}>No storefronts yet</h2>
          <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
            Create your first branded storefront to get started.
          </p>
          <Link href="/onboard" className="btn btn-primary">
            Create a storefront
          </Link>
        </div>
      </div>
    )
  }

  const totalGmvDisplay = `$${(dashboardData.totalGmvCents / 100).toFixed(2)}`
  const totalFeeDisplay = `$${(dashboardData.totalFeeCents / 100).toFixed(2)}`

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 className="text-display" style={{ marginBottom: '8px' }}>Store Dashboard</h1>
        <p className="text-body text-muted">Manage your branded storefronts and track your earnings</p>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '40px'
      }}>
        <div className="card" style={{ padding: '24px' }}>
          <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px' }}>
            Total GMV (All-Time)
          </div>
          <div className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {totalGmvDisplay}
          </div>
          <div className="text-small text-muted">across {dashboardData.storefronts.length} storefront{dashboardData.storefronts.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px' }}>
            Swagger Fee Revenue
          </div>
          <div className="text-display" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--color-accent)' }}>
            {totalFeeDisplay}
          </div>
          <div className="text-small text-muted">your 15-22% take on GMV</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px' }}>
            Active Storefronts
          </div>
          <div className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {dashboardData.storefronts.filter(s => s.status === 'complete').length}
          </div>
          <div className="text-small text-muted">ready to accept orders</div>
        </div>
      </div>

      {/* Storefronts table */}
      <div style={{ marginBottom: '40px' }}>
        <h2 className="text-h2" style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Your Storefronts</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Domain
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Company
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  GMV
                </th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Fee Revenue
                </th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Orders
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.storefronts.map((storefront) => (
                <tr key={storefront.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>
                    {storefront.domain}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                    {storefront.companyName || '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: storefront.status === 'complete' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: storefront.status === 'complete' ? '#22c55e' : '#6b7280'
                    }}>
                      {storefront.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                    {storefront.gmvDisplay}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-accent)' }}>
                    {storefront.swaggerFeeDisplay}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {storefront.orderCount}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <Link
                      href={`/storefront/${storefront.domain}`}
                      className="text-body"
                      style={{ textDecoration: 'none', color: 'var(--color-accent)', fontSize: '0.875rem' }}
                    >
                      View store →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create new storefront CTA */}
      <div style={{ textAlign: 'center', paddingTop: '24px', borderTop: '1px solid var(--color-border)' }}>
        <Link href="/onboard" className="btn btn-primary">
          Create another storefront
        </Link>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="container"><p className="text-muted" style={{ paddingTop: '40px' }}>Loading...</p></div>}>
      <DashboardContent />
    </Suspense>
  )
}
