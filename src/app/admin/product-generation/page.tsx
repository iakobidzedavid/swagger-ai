'use client'

import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'

interface ProductGenerationStatus {
  domain: string
  companyName: string | null
  logoUrl: string | null
  brandStatus: 'pending' | 'fetching' | 'detected' | 'failed'
  brandSource?: string | null
  colorCount?: number
  fontCount?: number
  storefrontStatus: string | null
  productCount: number
  syncedProductCount: number
  pendingProductCount: number
  failedProductCount: number
  domainSubmittedAt: string
  storefrontCreatedAt: string | null
  lastProductUpdate: string | null
}

interface PipelineMetrics {
  totalDomains: number
  domainsDetected: number
  storefrontsRequests: number
  productsGenerated: number
  productsSynced: number
  pendingSync: number
  failedSync: number
}

interface DashboardState {
  statuses: ProductGenerationStatus[]
  metrics: PipelineMetrics | null
  loadingState: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null
  lastUpdated: string | null
  autoRefresh: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'detected':
    case 'complete':
    case 'synced':
      return 'var(--color-success)'
    case 'pending':
    case 'queued':
      return 'var(--color-warning)'
    case 'fetching':
    case 'processing':
      return 'var(--color-info)'
    case 'failed':
      return 'var(--color-danger)'
    default:
      return 'var(--color-text-muted)'
  }
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const color = getStatusColor(status)
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
        whiteSpace: 'nowrap',
      }}
    >
      {label || status}
    </span>
  )
}

function ProgressBar({ synced, pending, failed, total }: { synced: number; pending: number; failed: number; total: number }) {
  if (total === 0) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        No products
      </div>
    )
  }

  const syncedPercent = (synced / total) * 100
  const pendingPercent = (pending / total) * 100
  const failedPercent = (failed / total) * 100

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          height: '6px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-border)',
          marginBottom: '6px',
        }}
      >
        {synced > 0 && (
          <div
            style={{
              width: `${syncedPercent}%`,
              backgroundColor: 'var(--color-success)',
              transition: 'width 0.3s ease',
            }}
          />
        )}
        {pending > 0 && (
          <div
            style={{
              width: `${pendingPercent}%`,
              backgroundColor: 'var(--color-warning)',
              transition: 'width 0.3s ease',
            }}
          />
        )}
        {failed > 0 && (
          <div
            style={{
              width: `${failedPercent}%`,
              backgroundColor: 'var(--color-danger)',
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '16px' }}>
        {synced > 0 && <span>✓ {synced}</span>}
        {pending > 0 && <span>⋯ {pending}</span>}
        {failed > 0 && <span>✕ {failed}</span>}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string
  value: string | number
  subtext?: string
  accent?: boolean
}) {
  return (
    <div
      className="card"
      style={{
        padding: '24px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            marginBottom: '8px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: accent ? 'var(--color-accent)' : 'var(--color-text)',
            marginBottom: '8px',
          }}
        >
          {value}
        </div>
      </div>
      {subtext && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}

function DashboardContent() {
  const [state, setState] = useState<DashboardState>({
    statuses: [],
    metrics: null,
    loadingState: 'loading',
    error: null,
    lastUpdated: null,
    autoRefresh: true,
  })

  const fetchData = async () => {
    try {
      setState(prev => ({ ...prev, loadingState: 'loading' }))

      const response = await fetch('/api/admin/product-generation')
      if (!response.ok) {
        throw new Error('Failed to fetch product generation status')
      }

      const data = await response.json()
      setState(prev => ({
        ...prev,
        statuses: data.statuses,
        metrics: data.metrics,
        loadingState: 'loaded',
        error: null,
        lastUpdated: data.timestamp,
      }))
    } catch (err) {
      console.error('Dashboard error:', err)
      setState(prev => ({
        ...prev,
        loadingState: 'error',
        error: 'Failed to load dashboard',
      }))
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-refresh every 10 seconds when page is visible
  useEffect(() => {
    if (!state.autoRefresh) {return}

    const handleVisibilityChange = () => {
      if (!document.hidden && state.autoRefresh) {
        fetchData()
      }
    }

    const interval = setInterval(() => {
      if (!document.hidden && state.autoRefresh) {
        fetchData()
      }
    }, 10000)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [state.autoRefresh])

  if (state.loadingState === 'loading') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="text-center">
          <p className="text-muted">Loading product generation dashboard...</p>
        </div>
      </div>
    )
  }

  if (state.loadingState === 'error') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          {state.error}
        </div>
      </div>
    )
  }

  const conversionRate = state.metrics
    ? state.metrics.totalDomains > 0
      ? ((state.metrics.domainsDetected / state.metrics.totalDomains) * 100).toFixed(1)
      : '0'
    : '0'

  const syncRate = state.metrics
    ? state.metrics.productsGenerated > 0
      ? ((state.metrics.productsSynced / state.metrics.productsGenerated) * 100).toFixed(1)
      : '0'
    : '0'

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-display" style={{ marginBottom: '8px' }}>
            Product Generation Pipeline
          </h1>
          <p className="text-body text-muted">
            Monitor brand extraction, product generation, and Printify sync status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: state.autoRefresh ? 'var(--color-accent)' : 'var(--color-surface)',
              color: state.autoRefresh ? 'var(--color-on-accent)' : 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {state.autoRefresh ? '🔄 Auto-refresh ON' : '⏹ Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchData}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Pipeline Metrics */}
      {state.metrics && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '40px',
            }}
          >
            <MetricCard label="Total Domains Submitted" value={state.metrics.totalDomains} />
            <MetricCard
              label="Brands Extracted"
              value={state.metrics.domainsDetected}
              subtext={`${conversionRate}% conversion`}
              accent
            />
            <MetricCard label="Storefront Requests" value={state.metrics.storefrontsRequests} />
            <MetricCard label="Products Generated" value={state.metrics.productsGenerated} />
            <MetricCard
              label="Products Synced"
              value={state.metrics.productsSynced}
              subtext={`${syncRate}% of generated`}
              accent
            />
            <MetricCard label="Pending Sync" value={state.metrics.pendingSync} />
            <MetricCard label="Failed Sync" value={state.metrics.failedSync} />
          </div>

          {/* Pipeline Progress Overview */}
          <div
            style={{
              marginBottom: '40px',
              padding: '24px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>Pipeline Flow</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                  Domain Submission
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{state.metrics.totalDomains}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>→</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                  Brand Detection
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{state.metrics.domainsDetected}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>→</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                  Product Generation
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{state.metrics.productsGenerated}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>→</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                  Printify Sync
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{state.metrics.productsSynced}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detailed Status Table */}
      <div>
        <h2 className="text-h2" style={{ marginBottom: '16px', fontSize: '1.25rem' }}>
          Domain Submissions
        </h2>

        {state.statuses.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p className="text-body text-muted">No domain submissions yet.</p>
            <Link href="/onboard" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Start Onboarding
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left' as const,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    Domain
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left' as const,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    Brand Status
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left' as const,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    Storefront
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left' as const,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    Product Sync Status
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left' as const,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.statuses.map(status => (
                  <tr key={status.domain} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{status.domain}</div>
                      {status.companyName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {status.companyName}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <StatusBadge status={status.brandStatus} />
                        {status.brandSource && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            ({status.brandSource})
                          </span>
                        )}
                      </div>
                      {status.colorCount !== undefined && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {status.colorCount} colors, {status.fontCount} fonts
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                      }}
                    >
                      {status.storefrontStatus ? (
                        <StatusBadge status={status.storefrontStatus} />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No storefront</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                      }}
                    >
                      {status.productCount > 0 ? (
                        <ProgressBar
                          synced={status.syncedProductCount}
                          pending={status.pendingProductCount}
                          failed={status.failedProductCount}
                          total={status.productCount}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No products</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(status.domainSubmittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Last Updated */}
      {state.lastUpdated && (
        <div
          style={{
            marginTop: '30px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          Last updated: {formatDate(state.lastUpdated)}
        </div>
      )}
    </div>
  )
}

export default function ProductGenerationDashboard() {
  return (
    <Suspense fallback={<div className="container"><p className="text-muted" style={{ paddingTop: '40px' }}>Loading...</p></div>}>
      <DashboardContent />
    </Suspense>
  )
}
