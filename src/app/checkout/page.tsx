'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'

interface ShippingInfo {
  email: string
  name: string
  address: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface PaymentInfo {
  cardNumber: string
  expiry: string
  cvc: string
}

type CheckoutStep = 'shipping' | 'payment' | 'review' | 'processing' | 'success' | 'error'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''
  const { cart, clearCart } = useCart()

  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    email: '',
    name: '',
    address: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  })

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    cardNumber: '',
    expiry: '',
    cvc: '',
  })

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }))
  }

  const handlePaymentChange = (field: keyof PaymentInfo, value: string) => {
    setPaymentInfo(prev => ({ ...prev, [field]: value }))
  }

  const validateShipping = (): boolean => {
    if (!shippingInfo.email || !shippingInfo.name || !shippingInfo.address || !shippingInfo.city || !shippingInfo.state || !shippingInfo.zipCode) {
      setError('Please fill in all required shipping fields')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.email)) {
      setError('Please enter a valid email address')
      return false
    }
    return true
  }

  const validatePayment = (): boolean => {
    if (!paymentInfo.cardNumber || !paymentInfo.expiry || !paymentInfo.cvc) {
      setError('Please fill in all payment fields')
      return false
    }
    if (paymentInfo.cardNumber.replace(/\s/g, '').length < 13) {
      setError('Please enter a valid card number')
      return false
    }
    if (paymentInfo.cvc.length < 3) {
      setError('Please enter a valid CVC')
      return false
    }
    return true
  }

  const handleProceedToPayment = () => {
    if (validateShipping()) {
      setError(null)
      setStep('payment')
    }
  }

  const handleProceedToReview = () => {
    if (validatePayment()) {
      setError(null)
      setStep('review')
    }
  }

  const handlePlaceOrder = async () => {
    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          items: cart.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.product.title,
            productSku: item.product.sku,
            unitPrice: item.unitPrice,
          })),
          totalAmount: cart.totalPrice,
          shippingInfo,
          paymentInfo: {
            // In production, token this with Stripe before sending
            last4: paymentInfo.cardNumber.slice(-4),
            brand: detectCardBrand(paymentInfo.cardNumber),
          },
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Failed to create order')
      }

      // Clear cart on success
      clearCart()

      // Redirect to success page
      setStep('success')
      setTimeout(() => {
        router.push(`/order-confirmation?orderId=${json.orderId}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process order')
      setStep('error')
    } finally {
      setProcessing(false)
    }
  }

  if (cart.items.length === 0 && step !== 'success') {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Your cart is empty
          </div>
          <Link href={`/storefront/${encodeURIComponent(domain)}`} className="btn btn-secondary btn-full">
            Return to Store
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Checkout
          </h1>
          <p className="text-body text-muted">
            Complete your order
          </p>
        </div>

        {/* Progress */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '40px',
            gap: '12px',
          }}
        >
          {(['shipping', 'payment', 'review'] as const).map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background:
                    s === step
                      ? 'var(--color-accent)'
                      : ['shipping', 'payment', 'review'].indexOf(s) < ['shipping', 'payment', 'review'].indexOf(step)
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  fontWeight: 'bold',
                }}
              >
                {i + 1}
              </div>
              <div className="text-small" style={{ textTransform: 'capitalize' }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
          {/* Main Content */}
          <div>
            {/* Shipping Step */}
            {(step === 'shipping' || ['payment', 'review', 'processing', 'success', 'error'].includes(step)) && (
              <div className="card" style={{ marginBottom: '24px', opacity: step === 'shipping' ? 1 : 0.6 }}>
                <h2 className="text-h2" style={{ marginBottom: '20px' }}>
                  Shipping Address
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="text-small font-semibold text-muted">Email *</label>
                    <input
                      type="email"
                      value={shippingInfo.email}
                      onChange={e => handleShippingChange('email', e.target.value)}
                      disabled={step !== 'shipping'}
                      placeholder="your@email.com"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-small font-semibold text-muted">Full Name *</label>
                    <input
                      type="text"
                      value={shippingInfo.name}
                      onChange={e => handleShippingChange('name', e.target.value)}
                      disabled={step !== 'shipping'}
                      placeholder="John Doe"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="text-small font-semibold text-muted">Address *</label>
                  <input
                    type="text"
                    value={shippingInfo.address}
                    onChange={e => handleShippingChange('address', e.target.value)}
                    disabled={step !== 'shipping'}
                    placeholder="123 Main St"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      marginTop: '6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="text-small font-semibold text-muted">Apt, suite, etc. (optional)</label>
                  <input
                    type="text"
                    value={shippingInfo.addressLine2}
                    onChange={e => handleShippingChange('addressLine2', e.target.value)}
                    disabled={step !== 'shipping'}
                    placeholder="Apt 5B"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      marginTop: '6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="text-small font-semibold text-muted">City *</label>
                    <input
                      type="text"
                      value={shippingInfo.city}
                      onChange={e => handleShippingChange('city', e.target.value)}
                      disabled={step !== 'shipping'}
                      placeholder="New York"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-small font-semibold text-muted">State *</label>
                    <input
                      type="text"
                      value={shippingInfo.state}
                      onChange={e => handleShippingChange('state', e.target.value)}
                      disabled={step !== 'shipping'}
                      placeholder="NY"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="text-small font-semibold text-muted">ZIP Code *</label>
                    <input
                      type="text"
                      value={shippingInfo.zipCode}
                      onChange={e => handleShippingChange('zipCode', e.target.value)}
                      disabled={step !== 'shipping'}
                      placeholder="10001"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-small font-semibold text-muted">Country *</label>
                    <select
                      value={shippingInfo.country}
                      onChange={e => handleShippingChange('country', e.target.value)}
                      disabled={step !== 'shipping'}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: step !== 'shipping' ? 'not-allowed' : 'auto',
                      }}
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>

                {step === 'shipping' && (
                  <button onClick={handleProceedToPayment} className="btn btn-primary btn-full" style={{ marginTop: '24px' }}>
                    Continue to Payment
                  </button>
                )}
              </div>
            )}

            {/* Payment Step */}
            {(step === 'payment' || ['review', 'processing', 'success', 'error'].includes(step)) && (
              <div className="card" style={{ marginBottom: '24px', opacity: step === 'payment' ? 1 : 0.6 }}>
                <h2 className="text-h2" style={{ marginBottom: '20px' }}>
                  Payment Information
                </h2>

                <div style={{ marginBottom: '16px' }}>
                  <label className="text-small font-semibold text-muted">Card Number *</label>
                  <input
                    type="text"
                    value={paymentInfo.cardNumber}
                    onChange={e => handlePaymentChange('cardNumber', e.target.value.replace(/\D/g, '').slice(0, 16))}
                    disabled={step !== 'payment'}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      marginTop: '6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      cursor: step !== 'payment' ? 'not-allowed' : 'auto',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="text-small font-semibold text-muted">Expiry (MM/YY) *</label>
                    <input
                      type="text"
                      value={paymentInfo.expiry}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '').slice(0, 4)
                        if (val.length >= 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2)
                        }
                        handlePaymentChange('expiry', val)
                      }}
                      disabled={step !== 'payment'}
                      placeholder="12/25"
                      maxLength={5}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        cursor: step !== 'payment' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-small font-semibold text-muted">CVC *</label>
                    <input
                      type="text"
                      value={paymentInfo.cvc}
                      onChange={e => handlePaymentChange('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                      disabled={step !== 'payment'}
                      placeholder="123"
                      maxLength={4}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginTop: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        cursor: step !== 'payment' ? 'not-allowed' : 'auto',
                      }}
                    />
                  </div>
                </div>

                {step === 'payment' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button
                      onClick={() => setStep('shipping')}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleProceedToReview}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      Review Order
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Review Step */}
            {(step === 'review' || ['processing', 'success', 'error'].includes(step)) && (
              <div className="card" style={{ marginBottom: '24px', opacity: step === 'review' ? 1 : 0.6 }}>
                <h2 className="text-h2" style={{ marginBottom: '20px' }}>
                  Order Review
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase' }}>
                    Shipping Address
                  </div>
                  <div className="text-body" style={{ marginBottom: '4px' }}>
                    {shippingInfo.name}
                  </div>
                  <div className="text-body text-muted" style={{ marginBottom: '4px' }}>
                    {shippingInfo.address}
                    {shippingInfo.addressLine2 && `, ${shippingInfo.addressLine2}`}
                  </div>
                  <div className="text-body text-muted" style={{ marginBottom: '4px' }}>
                    {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
                  </div>
                  <div className="text-body text-muted">
                    {shippingInfo.country}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase' }}>
                    Payment Method
                  </div>
                  <div className="text-body text-muted">
                    {detectCardBrand(paymentInfo.cardNumber)} ending in {paymentInfo.cardNumber.slice(-4)}
                  </div>
                </div>

                {step === 'review' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button
                      onClick={() => setStep('payment')}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing}
                      className="btn btn-primary"
                      style={{ flex: 1, opacity: processing ? 0.6 : 1, cursor: processing ? 'not-allowed' : 'pointer' }}
                    >
                      {processing ? 'Processing...' : 'Place Order'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
            <div className="card">
              <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                Order Summary
              </div>

              {cart.items.map(item => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '13px',
                  }}
                >
                  <span>
                    {item.product.title} x{item.quantity}
                  </span>
                  <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}

              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '12px',
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span className="text-h3">Total</span>
                <span className="text-h3" style={{ color: 'var(--color-accent)' }}>
                  ${cart.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function detectCardBrand(cardNumber: string): string {
  const number = cardNumber.replace(/\D/g, '')
  if (/^4/.test(number)) return 'Visa'
  if (/^5[1-5]/.test(number)) return 'Mastercard'
  if (/^3[47]/.test(number)) return 'American Express'
  if (/^6(?:011|5)/.test(number)) return 'Discover'
  return 'Card'
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
