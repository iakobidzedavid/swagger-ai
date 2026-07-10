'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Metrics {
  gmv: string
  revenue: string
  vendorPayout: string
  margin: string
  orders: number
  avgOrderValue: string
}

interface OrderData {
  id: string
  storefrontId: string
  domain: string
  companyName: string
  customerEmail: string
  customerName: string
  gmvDisplay: string
  swaggerFeeDisplay: string
  vendorPayoutDisplay: string
  marginPercentage: number
  status: string
  createdAtDisplay: string
}

interface StorefrontData {
  id: string
  domain: string
  companyName: string
  status: string
  createdAt: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  gmvCents: number
  gmvDisplay: string
  orderCount: number
  brandFidelity?: {
    responseCount: number
    brandAccuracyPct: number | null
    reorderRatePct: number | null
  }
}

interface DashboardState {
  metrics: Metrics | null
  orders: OrderData[]
  storefronts: StorefrontData[]
  totalOrderCount: number
  loadingState: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null
  dateFrom: string
  dateTo: string
  sortBy: string
  sortDir: 'asc' | 'desc'
  selectedStorefront: string | 'all'
  activeTab: 'overview' | 'brands' | 'orders'
}

function DashboardContent() {
  // Initialize with empty state visible to ensure empty-state content is in initial render
  // This allows unauthenticated users to see friendly empty-state CTAs immediately
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    orders: [],
    storefronts: [],
    totalOrderCount: 0,
    loadingState: 'loaded', // Start as 'loaded' with empty data — shows empty states immediately
    error: null,
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortDir: 'desc',
    selectedStorefront: 'all',
    activeTab: 'orders' // Default to orders tab to show the empty-state CTA
  })

  // Fetch metrics, orders, and storefronts
  const fetchData = async (filterParams?: Partial<DashboardState>) => {
    try {
      setState(prev => ({ ...prev, loadingState: 'loading' }))

      const token = localStorage.getItem('supabase_auth_token') || null
      const params = filterParams || state

      // Build query string for filters
      const metricsParams = new URLSearchParams()
      if (params.dateFrom) {metricsParams.append('dateFrom', params.dateFrom)}
      if (params.dateTo) {metricsParams.append('dateTo', params.dateTo)}

      const ordersParams = new URLSearchParams()
      ordersParams.append('limit', '100')
      ordersParams.append('offset', '0')
      ordersParams.append('sortBy', params.sortBy || 'created_at')
      ordersParams.append('sortDir', params.sortDir || 'desc')
      if (params.dateFrom) {ordersParams.append('dateFrom', params.dateFrom)}
      if (params.dateTo) {ordersParams.append('dateTo', params.dateTo)}
      if (params.selectedStorefront && params.selectedStorefront !== 'all') {
        ordersParams.append('storefrontId', params.selectedStorefront)
      }

      // If no authentication token, show empty state - allow unauthenticated users to see the dashboard
      if (!token) {
        setState(prev => ({
          ...prev,
          metrics: null,
          orders: [],
          storefronts: [],
          totalOrderCount: 0,
          loadingState: 'loaded',
          error: null,
          ...filterParams
        }))
        return
      }

      // Fetch metrics, orders, and storefronts in parallel (only if authenticated)
      const [metricsRes, ordersRes, storefrontsRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?${metricsParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/dashboard/orders?${ordersParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/dashboard/storefronts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!metricsRes.ok || !ordersRes.ok) {
        // Extract error details from API response
        const failedRes = !metricsRes.ok ? metricsRes : ordersRes
        const errorData = await failedRes.json().catch(() => ({}))
        const errorMsg = errorData.error || `HTTP ${failedRes.status}`
        throw new Error(`Failed to fetch dashboard data: ${errorMsg}`)
      }

      const metricsData = await metricsRes.json()
      const ordersData = await ordersRes.json()
      const storefrontsData = storefrontsRes.ok ? await storefrontsRes.json() : { storefronts: [] }

      // Validate response schema to prevent undefined field crashes
      if (!metricsData.metrics || !ordersData.orders || typeof ordersData.totalCount !== 'number') {
        throw new Error('Invalid API response schema')
      }

      setState(prev => ({
        ...prev,
        metrics: metricsData.metrics,
        orders: ordersData.orders,
        storefronts: storefrontsData.storefronts || [],
        totalOrderCount: ordersData.totalCount,
        loadingState: 'loaded',
        error: null,
        ...filterParams
      }))
    } catch (err) {
      console.error('Dashboard error:', err)
      setState(prev => ({
        ...prev,
        loadingState: 'error',
        error: 'Failed to load dashboard'
      }))
    }
  }

  // Fetch data on mount — will show empty states for unauthenticated users,
  // and load real data for authenticated users
  useEffect(() => {
    fetchData()
  }, []) // Empty dependency array — runs once on mount

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const newState = { ...state, [field]: value }
    setState(newState)
    fetchData(newState)
  }

  const handleSort = (column: string) => {
    const newSortDir: 'asc' | 'desc' = state.sortBy === column && state.sortDir === 'desc' ? 'asc' : 'desc'
    const newState: DashboardState = { ...state, sortBy: column, sortDir: newSortDir }
    setState(newState)
    fetchData(newState)
  }

  if (state.loadingState === 'loading') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="text-center">
          <p className="text-muted">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (state.loadingState === 'error') {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="error-banner">{state.error}</div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="text-display" style={{ marginBottom: '8px' }}>Admin Dashboard</h1>
        <p className="text-body text-muted">Monitor orders, brand extractions, and monetization metrics</p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '40px',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '16px'
      }}>
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'overview' }))}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: state.activeTab === 'overview' ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontWeight: state.activeTab === 'overview' ? 600 : 400,
            fontSize: '1rem',
            borderBottom: state.activeTab === 'overview' ? '2px solid var(--color-accent)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'brands' }))}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: state.activeTab === 'brands' ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontWeight: state.activeTab === 'brands' ? 600 : 400,
            fontSize: '1rem',
            borderBottom: state.activeTab === 'brands' ? '2px solid var(--color-accent)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          Brand Extractions ({state.storefronts.length})
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'orders' }))}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: state.activeTab === 'orders' ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontWeight: state.activeTab === 'orders' ? 600 : 400,
            fontSize: '1rem',
            borderBottom: state.activeTab === 'orders' ? '2px solid var(--color-accent)' : '2px solid transparent',
            marginBottom: '-17px'
          }}
        >
          Orders ({state.totalOrderCount})
        </button>
      </div>

      {/* Content based on active tab */}
      {state.activeTab === 'overview' && (
        <>
          {/* Key Metrics */}
          {state.metrics && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '40px'
            }}>
              <MetricCard
                label="Total GMV (All-Time)"
                value={state.metrics.gmv}
                subtext={`${state.totalOrderCount} orders`}
              />
              <MetricCard
                label="Swagger Revenue"
                value={state.metrics.revenue}
                subtext={state.metrics.margin}
                accent
              />
              <MetricCard
                label="Vendor Payout"
                value={state.metrics.vendorPayout}
                subtext="to Printify"
              />
              <MetricCard
                label="Avg Order Value"
                value={state.metrics.avgOrderValue}
                subtext={state.metrics.orders > 0 ? `${state.metrics.orders} orders` : 'No orders'}
              />
            </div>
          )}

          {/* Quick Stats */}
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            marginBottom: '40px'
          }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>Key Metrics</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Active Storefronts</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{state.storefronts.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Orders</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{state.totalOrderCount}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Brands Extracted</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{state.storefronts.filter(s => s.primaryColor).length}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Brand Extractions Tab */}
      {state.activeTab === 'brands' && (
        <div>
          <h2 className="text-h2" style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Brand Extractions</h2>

          {state.storefronts.length === 0 ? (
            <div style={{
              padding: '48px 40px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '16px'
              }}>
                ✨
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'var(--color-text)'
              }}>
                No brand extractions yet
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                marginBottom: '24px',
                maxWidth: '400px',
                margin: '0 auto 24px'
              }}>
                Get started by creating your first storefront. We'll automatically extract your brand colors and logo to create a beautiful, on-brand merchandising experience.
              </p>
              <Link href="/onboard" className="btn btn-primary">
                Create Your First Storefront
              </Link>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {state.storefronts.map((sf) => (
                <div
                  key={sf.id}
                  style={{
                    padding: '20px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Brand Logo and Colors */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {sf.logoUrl ? (
                      <img
                        src={sf.logoUrl}
                        alt={sf.companyName}
                        style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)'
                      }}>
                        No logo
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{sf.companyName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sf.domain}</div>
                    </div>
                  </div>

                  {/* Color Swatches */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {sf.primaryColor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: sf.primaryColor || 'var(--color-border)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer'
                          }}
                          title={sf.primaryColor || 'No color'}
                          aria-label={`Primary brand color: ${sf.primaryColor || 'not set'}`}
                          role="img"
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Primary</span>
                      </div>
                    )}
                    {sf.secondaryColor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: sf.secondaryColor || 'var(--color-border)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer'
                          }}
                          title={sf.secondaryColor || 'No color'}
                          aria-label={`Secondary brand color: ${sf.secondaryColor || 'not set'}`}
                          role="img"
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Secondary</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: '0.875rem'
                  }}>
                    <div>
                      <div style={{ color: 'var(--color-text-muted)' }}>Orders</div>
                      <div style={{ fontWeight: 600 }}>{sf.orderCount}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--color-text-muted)' }}>GMV</div>
                      <div style={{ fontWeight: 600 }}>{sf.gmvDisplay}</div>
                    </div>
                  </div>

                  {/* Brand Fidelity Score */}
                  {sf.brandFidelity && sf.brandFidelity.responseCount > 0 && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--color-accent-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      marginTop: '8px'
                    }}>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }}>Brand Fidelity Score</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                          {sf.brandFidelity.brandAccuracyPct}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {sf.brandFidelity.reorderRatePct !== null && (
                            <>
                              · {sf.brandFidelity.reorderRatePct}% reorder rate
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        from {sf.brandFidelity.responseCount} employee rating{sf.brandFidelity.responseCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}

                  {sf.brandFidelity && sf.brandFidelity.responseCount === 0 && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--color-overlay-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginTop: '8px'
                    }}>
                      🧵 New storefront — brand fidelity score appears after first order
                    </div>
                  )}

                  {/* Status */}
                  <div className={`status-pill ${sf.status === 'complete' ? 'status-pill-success' : 'status-pill-neutral'}`} style={{ marginTop: '12px' }}>
                    {sf.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {state.activeTab === 'orders' && (
        <div>
          {/* Filters */}
          <div style={{
            marginBottom: '30px',
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--color-text-muted)'
                }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={state.dateFrom}
                  onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--color-text-muted)'
                }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={state.dateTo}
                  onChange={(e) => handleDateChange('dateTo', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <h2 className="text-h2" style={{ marginBottom: '16px', fontSize: '1.25rem' }}>All Orders</h2>

          {state.orders.length === 0 ? (
            <div style={{
              padding: '48px 40px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '16px'
              }}>
                📦
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'var(--color-text)'
              }}>
                No orders yet
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                marginBottom: '24px',
                maxWidth: '400px',
                margin: '0 auto 24px'
              }}>
                Your storefront is ready to go! Once your first customers place orders, they'll appear here. Create a storefront or share your existing one to start getting orders.
              </p>
              <Link href="/onboard" className="btn btn-primary">
                Create a New Storefront
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={tableHeaderStyle}>
                      <button
                        onClick={() => handleSort('created_at')}
                        style={sortButtonStyle}
                      >
                        Date {state.sortBy === 'created_at' && (state.sortDir === 'desc' ? '↓' : '↑')}
                      </button>
                    </th>
                    <th style={tableHeaderStyle}>Company</th>
                    <th style={tableHeaderStyle}>Customer</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => handleSort('total_amount_cents')}
                        style={sortButtonStyle}
                      >
                        GMV {state.sortBy === 'total_amount_cents' && (state.sortDir === 'desc' ? '↓' : '↑')}
                      </button>
                    </th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => handleSort('swagger_fee_cents')}
                        style={sortButtonStyle}
                      >
                        Swagger Fee {state.sortBy === 'swagger_fee_cents' && (state.sortDir === 'desc' ? '↓' : '↑')}
                      </button>
                    </th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Margin</th>
                    <th style={tableHeaderStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tableCellStyle}>{order.createdAtDisplay}</td>
                      <td style={tableCellStyle}>
                        <div style={{ fontWeight: 600 }}>{order.companyName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {order.domain}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: '0.875rem' }}>{order.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {order.customerEmail}
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600 }}>
                        {order.gmvDisplay}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600, color: 'var(--color-accent)' }}>
                        {order.swaggerFeeDisplay}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-accent)'
                        }}>
                          {order.marginPercentage}%
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span className={`status-pill ${order.status === 'completed' ? 'status-pill-success' : 'status-pill-neutral'}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, subtext, accent }: { label: string; value: string; subtext: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px' }}>
          {label}
        </div>
        <div style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: accent ? 'var(--color-accent)' : 'var(--color-text)',
          marginBottom: '8px'
        }}>
          {value}
        </div>
      </div>
      <div className="text-small text-muted">
        {subtext}
      </div>
    </div>
  )
}

const tableHeaderStyle = {
  padding: '12px',
  textAlign: 'left' as const,
  fontWeight: 600,
  fontSize: '0.875rem',
  color: 'var(--color-text-muted)',
  backgroundColor: 'var(--color-overlay-subtle)'
}

const tableCellStyle = {
  padding: '12px',
  fontSize: '0.875rem',
  color: 'var(--color-text)'
}

const sortButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: 0,
  textAlign: 'left' as const
}

export default function DashboardPage() {
  // Render DashboardContent directly without Suspense to ensure
  // empty states are in the initial HTML (not hidden behind Suspense fallback)
  return <DashboardContent />
}
