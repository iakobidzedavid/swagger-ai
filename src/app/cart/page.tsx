'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useCart } from '@/context/CartContext'

function CartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''
  const { cart, removeFromCart, updateQuantity } = useCart()

  const handleCheckout = () => {
    if (cart.items.length === 0) {
      alert('Your cart is empty')
      return
    }
    router.push(`/checkout?domain=${encodeURIComponent(domain)}`)
  }

  const handleContinueShopping = () => {
    router.push(`/storefront/${encodeURIComponent(domain)}`)
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="text-h1" style={{ marginBottom: '8px' }}>
            Shopping Cart
          </h1>
          <p className="text-body text-muted">
            Review your selected items and proceed to checkout.
          </p>
        </div>

        {/* Cart Items */}
        {cart.items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ margin: '0 auto 16px', color: 'var(--color-text-muted)' }}
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <h2 className="text-h2" style={{ marginBottom: '12px' }}>
              Cart is Empty
            </h2>
            <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
              Add some items to get started!
            </p>
            <button onClick={handleContinueShopping} className="btn btn-primary">
              Continue Shopping
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
            {/* Items List */}
            <div>
              {cart.items.map(item => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="card"
                  style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '20px' }}
                >
                  {/* Item Image */}
                  <div
                    style={{
                      width: '100%',
                      height: '120px',
                      background: 'var(--color-canvas-surface)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Item Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="text-h3" style={{ margin: '0 0 4px' }}>
                        {item.product.title}
                      </h3>
                      <p className="text-small text-muted" style={{ margin: '0 0 16px' }}>
                        SKU: {item.product.sku}
                      </p>

                      {/* Variant Display */}
                      <div style={{ marginBottom: '16px' }}>
                        <p className="text-small text-muted" style={{ margin: '0 0 4px' }}>
                          Variant
                        </p>
                        <p className="text-body" style={{ margin: '0' }}>
                          {item.product.variants.find(v => v.id === item.variantId)?.title || 'Unknown variant'}
                        </p>
                      </div>

                      {/* Pricing Details */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <p className="text-small text-muted" style={{ margin: '0 0 4px' }}>
                            Unit Price
                          </p>
                          <p className="text-body" style={{ margin: '0' }}>
                            ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <label className="text-small text-muted" style={{ display: 'block', marginBottom: '4px' }}>
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={item.quantity}
                            onChange={e => {
                              const newQty = parseInt(e.target.value, 10)
                              if (newQty > 0) {
                                updateQuantity(item.productId, item.variantId, newQty)
                              }
                            }}
                            className="input-field"
                            style={{
                              width: '70px',
                              padding: '8px 10px',
                            }}
                          />
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                          <p className="text-small text-muted" style={{ margin: '0 0 4px' }}>
                            Line Total
                          </p>
                          <p className="text-h3" style={{ margin: '0', color: 'var(--color-accent)' }}>
                            ${(item.unitPrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.productId, item.variantId)}
                      style={{
                        marginTop: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        padding: '4px 0',
                        textAlign: 'left',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      Remove from Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary Sidebar */}
            <div style={{ position: 'sticky', top: '80px', height: 'fit-content' }}>
              <div className="card">
                <div style={{ marginBottom: '24px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Order Summary
                  </div>

                  {/* Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="text-body">Subtotal</span>
                    <span className="text-body">${cart.totalPrice.toFixed(2)}</span>
                  </div>

                  {/* Item count */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="text-small text-muted">{cart.totalItems} item{cart.totalItems !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <span className="text-h3">Total</span>
                    <span className="text-h3" style={{ color: 'var(--color-accent)' }}>
                      ${cart.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button onClick={handleCheckout} className="btn btn-primary btn-full" style={{ marginBottom: '12px' }}>
                  Proceed to Checkout
                </button>

                <button
                  onClick={handleContinueShopping}
                  className="btn btn-secondary btn-full"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CartContent />
    </Suspense>
  )
}
