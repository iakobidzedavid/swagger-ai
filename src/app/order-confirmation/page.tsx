'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

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
}

type LoadingState = 'loading' | 'loaded' | 'error'

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<OrderData | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '600px' }}>
        {/* Success Banner */}
        <div className="success-banner" style={{ marginBottom: '32px' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Order placed successfully!
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Thank You! 🎉
          </h1>
          <p className="text-body text-muted">
            Your order has been received and is being processed. You'll receive a shipping confirmation email shortly.
          </p>
        </div>

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
                  onClick={async () => {
                    await navigator.clipboard.writeText(order.id)
                    alert('Order ID copied!')
                  }}
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
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Date */}
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Date
              </div>
              <div className="text-body">{order.createdAt}</div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Confirmation Email
              </div>
              <div className="text-body">{order.customerEmail}</div>
            </div>

            {/* Status */}
            <div>
              <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                Status
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {order.status}
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div className="text-small font-semibold text-muted" style={{ marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
            Items
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
              <div className="text-body font-semibold">
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
            <span className="text-small text-muted">Processing Fee</span>
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
        <div className="card" style={{ marginBottom: '24px', background: 'var(--color-surface)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="text-h3" style={{ marginBottom: '12px' }}>
              What's Next?
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Confirmation email sent</strong> — Check your inbox for order details and tracking info
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Processing in progress</strong> — Your items will ship within 5–7 business days
                </span>
              </li>
              <li style={{ color: 'var(--color-text)', fontSize: '14px', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px' }}>✓</span>
                <span>
                  <strong>Track your shipment</strong> — You'll receive a shipping confirmation with tracking number
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Link href="/" className="btn btn-secondary">
            Continue Shopping
          </Link>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
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
