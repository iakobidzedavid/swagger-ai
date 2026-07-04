'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getStatusBadge } from '@/lib/order-status'
import { DesignFeedbackWidget } from '@/components/DesignFeedbackWidget'

interface OrderData {
  id: string
  customerEmail: string
  customerName: string
  totalAmount: number
  swaggerFee: number
  status: string
  createdAt: string
  items: Array<{
    productName: string
    productSku: string
    quantity: number
    totalPrice: number
  }>
  trackingNumber?: string
  trackingCarrier?: string
  trackingUrl?: string
  shippedAt?: string
  deliveredAt?: string
}

type LoadingState = 'loading' | 'loaded' | 'error'

// Timeline component
function OrderTimeline({ order }: { order: OrderData }) {
  const steps = [
    { label: 'Order Placed', date: order.createdAt, completed: true },
    { label: 'Processing', date: undefined, completed: order.status !== 'pending' },
    { label: 'Shipped', date: order.shippedAt, completed: order.status === 'completed' || !!order.deliveredAt },
    { label: 'Delivered', date: order.deliveredAt, completed: !!order.deliveredAt },
  ]

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 className="text-h3" style={{ marginBottom: '24px' }}>
        Order Status Timeline
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {steps.map((step, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '16px', paddingBottom: '24px' }}>
            {/* Timeline dot and line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: step.completed ? 'var(--color-success)' : 'var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: step.completed ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {step.completed ? '✓' : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  style={{
                    width: '2px',
                    height: '40px',
                    background: steps[idx + 1].completed ? 'var(--color-success)' : 'var(--color-border)',
                    marginTop: '8px',
                  }}
                />
              )}
            </div>

            {/* Timeline content */}
            <div style={{ flex: 1, paddingTop: '2px' }}>
              <div className="text-h3" style={{ marginBottom: '2px', color: step.completed ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {step.label}
              </div>
              {step.date && (
                <div className="text-small text-muted">{step.date}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<OrderData | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided')
      setLoadingState('error')
      return
    }

    // Fetch real order data from API
    fetch(`/api/order/${orderId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch order')
        }
        return res.json()
      })
      .then(data => {
        if (data.success && data.order) {
          setOrder(data.order)
          setLoadingState('loaded')
        } else {
          setError(data.error || 'Order not found')
          setLoadingState('error')
        }
      })
      .catch(err => {
        console.error('Error fetching order:', err)
        setError('Failed to load order details')
        setLoadingState('error')
      })
  }, [orderId])

  const handleCopyId = async () => {
    if (order) {
      await navigator.clipboard.writeText(order.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loadingState === 'error') {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {error}
          </div>
          <Link href="/" className="btn btn-secondary btn-full">
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  if (loadingState === 'loading') {
    return (
      <div className="section">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading order confirmation…</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  const statusInfo = getStatusBadge(order.status)

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '680px' }}>
        {/* Success Banner */}
        <div className="success-banner" style={{ marginBottom: '32px' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Order placed successfully!
        </div>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '12px' }}>
            Thank You! 🎉
          </h1>
          <p className="text-body text-muted">
            Your order has been received and is being processed. Check your email for updates and tracking information.
          </p>
        </div>

        {/* Order Status Timeline */}
        <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
          <OrderTimeline order={order} />
        </div>

        {/* Tracking Information (if available) */}
        {order.trackingNumber && order.trackingCarrier && (
          <div
            className="card"
            style={{
              marginBottom: '32px',
              padding: '24px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                Shipping Tracking
              </div>

              {/* Carrier and Number */}
              <div style={{ marginBottom: '16px' }}>
                <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                  Tracking Number
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      flex: 1,
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
                      {order.trackingNumber}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyId}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-accent)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Carrier */}
              <div style={{ marginBottom: '16px' }}>
                <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                  Carrier
                </div>
                <div className="text-body">{order.trackingCarrier}</div>
              </div>

              {/* Tracking Link */}
              {order.trackingUrl && (
                <div>
                  <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                    View Shipment
                  </div>
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      fontWeight: 600,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                  >
                    Track shipment →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Details Card */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
              Order Details
            </div>

            {/* Order ID */}
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Order ID
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
                  {order.id}
                </code>
                <button
                  onClick={handleCopyId}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Grid: Date and Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                  Order Date
                </div>
                <div className="text-body">{order.createdAt}</div>
              </div>
              <div>
                <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                  Email
                </div>
                <div className="text-body" style={{ wordBreak: 'break-all' }}>
                  {order.customerEmail}
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Status
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                <span>{statusInfo.icon}</span>
                {statusInfo.label}
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div className="text-small font-semibold text-muted" style={{ marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
            Items Ordered
          </div>

          {order.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                marginBottom: '12px',
                borderBottom: idx < order.items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div>
                <div className="text-body" style={{ marginBottom: '4px' }}>
                  {item.productName}
                </div>
                <div className="text-small text-muted">
                  SKU: {item.productSku} • Qty: {item.quantity}
                </div>
              </div>
              <div className="text-body font-semibold" style={{ whiteSpace: 'nowrap', marginLeft: '16px' }}>
                ${item.totalPrice.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="text-body">Subtotal</span>
            <span className="text-body">${(order.totalAmount - order.swaggerFee).toFixed(2)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '12px',
              marginBottom: '12px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span className="text-small text-muted">Processing Fee (18%)</span>
            <span className="text-small text-muted">${order.swaggerFee.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-h3">Total</span>
            <span className="text-h3" style={{ color: 'var(--color-accent)' }}>
              ${order.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Next Steps */}
        <div className="card" style={{ marginBottom: '32px', background: 'var(--color-surface)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="text-h3" style={{ marginBottom: '16px' }}>
              What's Next?
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px', fontSize: '16px' }}>📧</span>
                <span>
                  <strong>Confirmation email sent</strong> — Check your inbox for order details and receipt
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px', fontSize: '16px' }}>⚙️</span>
                <span>
                  <strong>Processing in progress</strong> — Your items will ship within 5–7 business days
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px', fontSize: '16px' }}>📦</span>
                <span>
                  <strong>Track your shipment</strong> — You'll receive a tracking number and link via email
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px', fontSize: '16px' }}>🚚</span>
                <span>
                  <strong>Delivery updates</strong> — Real-time notifications as your order makes its way to you
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Brand Fidelity Feedback — closes the loop on Swagger AI's core design engine */}
        <DesignFeedbackWidget orderId={order.id} />

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Link href="/" className="btn btn-secondary">
            Continue Shopping
          </Link>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <OrderConfirmationContent />
    </Suspense>
  )
}
