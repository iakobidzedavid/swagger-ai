'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
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

type CheckoutStep = 'shipping' | 'payment' | 'review' | 'processing' | 'success' | 'error'

function CheckoutFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''
  const { cart, clearCart } = useCart()
  const stripe = useStripe()
  const elements = useElements()

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

  const [paymentIntentData, setPaymentIntentData] = useState<{ clientSecret: string; id: string } | null>(null)

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }))
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

  const handleProceedToPayment = async () => {
    if (!validateShipping()) {
      return
    }

    setError(null)
    setProcessing(true)

    try {
      // Create payment intent
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: shippingInfo.email,
          amountCents: Math.round(cart.totalPrice * 100),
          domain,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to create payment intent')
        setProcessing(false)
        return
      }

      setPaymentIntentData({
        clientSecret: data.clientSecret,
        id: data.paymentIntentId,
      })
      setStep('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment intent')
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!stripe || !elements || !paymentIntentData) {
      setError('Payment not initialized')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Confirm payment with card element
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentData.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      )

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setProcessing(false)
        return
      }

      if (paymentIntent?.status !== 'succeeded') {
        setError(`Payment failed with status: ${paymentIntent?.status}`)
        setProcessing(false)
        return
      }

      // Payment succeeded, proceed to review
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const handlePlaceOrder = async () => {
    if (!paymentIntentData) {
      setError('Payment not confirmed')
      return
    }

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
          paymentIntentId: paymentIntentData.id,
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Failed to create order')
      }

      clearCart()
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
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Checkout
          </h1>
          <p className="text-body text-muted">Complete your order</p>
        </div>

        {/* Premium Step Indicator */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            {['shipping', 'payment', 'review'].map((s, i) => {
              const stepOrder = ['shipping', 'payment', 'review']
              const currentIndex = stepOrder.indexOf(step as any)
              const isCompleted = stepOrder.indexOf(s) < currentIndex
              const isActive = s === step
              const isUpcoming = stepOrder.indexOf(s) > currentIndex

              return (
                <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: isActive ? 'var(--color-accent)' : isCompleted ? 'var(--color-accent)' : 'var(--color-border)',
                      color: isActive || isCompleted ? 'var(--color-on-accent)' : 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      transition: 'all 200ms ease',
                      flexShrink: 0,
                      boxShadow: isActive ? '0 0 0 4px rgba(124, 58, 237, 0.15)' : 'none',
                    }}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-small" style={{
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                      color: isActive ? 'var(--color-accent)' : isCompleted ? 'var(--color-success)' : 'var(--color-text-muted)',
                      transition: 'color 200ms ease',
                    }}>
                      {s}
                    </div>
                  </div>
                  {i < 2 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      background: isCompleted || isActive ? 'var(--color-accent)' : 'var(--color-border)',
                      marginLeft: '8px',
                      transition: 'background 200ms ease',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

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
                      className="input-field mt-2"
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
                      className="input-field mt-2"
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
                    className="input-field mt-2"
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
                    className="input-field mt-2"
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
                      className="input-field mt-2"
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
                      className="input-field mt-2"
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
                      className="input-field mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-small font-semibold text-muted">Country *</label>
                    <select
                      value={shippingInfo.country}
                      onChange={e => handleShippingChange('country', e.target.value)}
                      disabled={step !== 'shipping'}
                      className="input-field mt-2"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>

                {step === 'shipping' && (
                  <button
                    onClick={handleProceedToPayment}
                    disabled={processing}
                    className="btn btn-primary btn-full"
                    style={{ marginTop: '24px', opacity: processing ? 0.6 : 1, cursor: processing ? 'not-allowed' : 'pointer' }}
                  >
                    {processing ? 'Preparing Payment...' : 'Continue to Payment'}
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

                {step === 'payment' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-small font-semibold text-muted">Card Details *</label>
                      <div className="input-field mt-2">
                        <CardElement />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button
                        onClick={() => setStep('shipping')}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmPayment}
                        disabled={processing || !stripe}
                        className="btn btn-primary"
                        style={{ flex: 1, opacity: processing || !stripe ? 0.6 : 1, cursor: processing || !stripe ? 'not-allowed' : 'pointer' }}
                      >
                        {processing ? 'Processing...' : 'Confirm & Review'}
                      </button>
                    </div>
                  </div>
                )}

                {step !== 'payment' && (
                  <div className="text-small text-muted">Card information secured with Stripe</div>
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

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginBottom: '20px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase' }}>
                    Payment
                  </div>
                  <div className="text-body text-muted">Secured with Stripe • ${cart.totalPrice.toFixed(2)}</div>
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
                      {processing ? 'Processing Order...' : 'Place Order'}
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

export default function CheckoutFormPage() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!publishableKey) {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Stripe is not configured
          </div>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CheckoutFormContent />
    </Suspense>
  )
}
