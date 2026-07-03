'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'

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

interface DashboardState {
  metrics: Metrics | null
  orders: OrderData[]
  totalOrderCount: number
  loadingState: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null
  dateFrom: string
  dateTo: string
  sortBy: string
  sortDir: 'asc' | 'desc'
  selectedStorefront: string | 'all'
}

function DashboardContent() {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    orders: [],
    totalOrderCount: 0,
    loadingState: 'loading',
    error: null,
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortDir: 'desc',
    selectedStorefront: 'all'
  })

  // Fetch metrics and orders
  const fetchData = async (filterParams?: Partial<DashboardState>) => {
    try {
      setState(prev => ({ ...prev, loadingState: 'loading' }))

      const token = localStorage.getItem('supabase_auth_token') || 'placeholder'
      const params = filterParams || state

      // Build query string for filters
      const metricsParams = new URLSearchParams()
      if (params.dateFrom) metricsParams.append('dateFrom', params.dateFrom)
      if (params.dateTo) metricsParams.append('dateTo', params.dateTo)

      const ordersParams = new URLSearchParams()
      ordersParams.append('limit', '100')
      ordersParams.append('offset', '0')
      ordersParams.append('sortBy', params.sortBy || 'created_at')
      ordersParams.append('sortDir', params.sortDir || 'desc')
      if (params.dateFrom) ordersParams.append('dateFrom', params.dateFrom)
      if (params.dateTo) ordersParams.append('dateTo', params.dateTo)
      if (params.selectedStorefront && params.selectedStorefront !== 'all') {
        ordersParams.append('storefrontId', params.selectedStorefront)
      }

      // Fetch metrics and orders in parallel
      const [metricsRes, ordersRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?${metricsParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/dashboard/orders?${ordersParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!metricsRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const metricsData = await metricsRes.json()
      const ordersData = await ordersRes.json()

      setState(prev => ({
        ...prev,
        metrics: metricsData.metrics,
        orders: ordersData.orders,
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

  useEffect(() => {
    fetchData()
  }, [])

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
        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          {state.error}
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="text-display" style={{ marginBottom: '8px' }}>Admin Dashboard</h1>
        <p className="text-body text-muted">Monitor orders and monetization metrics</p>
      </div>

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
      <div>
        <h2 className="text-h2" style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Orders</h2>

        {state.orders.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
          }}>
            <p className="text-body text-muted">No orders found. Start by creating a storefront.</p>
            <Link href="/onboard" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Create Storefront
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
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: order.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        color: order.status === 'completed' ? '#10b981' : '#6b7280'
                      }}>
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
  backgroundColor: 'rgba(0, 0, 0, 0.2)'
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
  return (
    <Suspense fallback={<div className="container"><p className="text-muted" style={{ paddingTop: '40px' }}>Loading...</p></div>}>
      <DashboardContent />
    </Suspense>
  )
}
