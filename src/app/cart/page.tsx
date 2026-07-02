'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
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
                  style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '20px', padding: '20px' }}
                >
                  {/* Item Image */}
                  <div
                    style={{
                      width: '100%',
                      height: '120px',
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                      <h3 className="text-h3" style={{ margin: '0 0 4px', fontSize: '18px' }}>
                        {item.product.title}
                      </h3>
                      <p className="text-small text-muted" style={{ margin: '0 0 8px' }}>
                        SKU: {item.product.sku}
                      </p>

                      {/* Variant Selection */}
                      <div style={{ marginBottom: '12px' }}>
                        <select
                          value={item.variantId}
                          onChange={e => {
                            const variant = item.product.variants.find(v => v.id === e.target.value)
                            if (variant) {
                              removeFromCart(item.productId, item.variantId)
                              const cart = require('@/context/CartContext')
                              // This would require refactoring; for now just show selection is locked
                            }
                          }}
                          disabled
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg)',
                            color: 'var(--color-text)',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            cursor: 'not-allowed',
                          }}
                        >
                          {item.product.variants.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity and Price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="text-small text-muted">Qty:</label>
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
                            style={{
                              width: '60px',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg)',
                              color: 'var(--color-text)',
                              fontSize: '14px',
                              fontFamily: 'inherit',
                            }}
                          />
                        </div>
                        <div className="text-h3" style={{ marginLeft: 'auto' }}>
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.productId, item.variantId)}
                      style={{
                        marginTop: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        padding: 0,
                        textAlign: 'left',
                      }}
                    >
                      Remove from Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
              <div className="card">
                <div style={{ marginBottom: '20px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                    Order Summary
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span className="text-body">Subtotal ({cart.totalItems} items)</span>
                    <span className="text-body font-semibold">${cart.totalPrice.toFixed(2)}</span>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '12px',
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

                <button onClick={handleCheckout} className="btn btn-primary btn-full" style={{ marginBottom: '12px' }}>
                  Proceed to Checkout
                </button>

                <button
                  onClick={handleContinueShopping}
                  className="btn btn-secondary btn-full"
                  style={{}}
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
