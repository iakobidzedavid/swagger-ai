'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { normalizeDomain } from '@/lib/brand'
import { useCart } from '@/context/CartContext'

interface StorefrontProduct {
  id: string
  title: string
  description: string
  sku: string
  image: string
  mockupImage?: string
  category: string
  variants: Array<{
    id: string
    title: string
    price: number
  }>
}

interface StorefrontData {
  id: string
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  products: StorefrontProduct[]
}

type LoadingState = 'loading' | 'loaded' | 'error'

function StorefrontContent({ domain: paramDomain }: { domain: string }) {
  const [storefront, setStorefront] = useState<StorefrontData | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [cartCount, setCartCount] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const { addToCart, cart } = useCart()

  const domain = normalizeDomain(paramDomain)

  // Update cart count whenever items change
  useEffect(() => {
    setCartCount(cart.items.length)
  }, [cart.items])

  useEffect(() => {
    if (!domain) {
      setError('Invalid domain')
      setLoadingState('error')
      return
    }

    const fetchStorefront = async () => {
      try {
        const res = await fetch(`/api/storefront/fetch?domain=${encodeURIComponent(domain)}`)
        if (!res.ok) {
          throw new Error(`Failed to load storefront: ${res.statusText}`)
        }
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error || 'Unknown error')
        }
        setStorefront(json.data)
        setLoadingState('loaded')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load storefront')
        setLoadingState('error')
      }
    }

    fetchStorefront()
  }, [domain])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAddToCart = (product: StorefrontProduct) => {
    const variantId = selectedVariants[product.id]
    if (!variantId) {
      showToast('Please select a size/option', 'error')
      return
    }

    const variant = product.variants.find(v => v.id === variantId)
    if (!variant) {
      showToast('Invalid variant selected', 'error')
      return
    }

    addToCart(
      {
        id: product.id,
        title: product.title,
        sku: product.sku,
        image: product.mockupImage || product.image,
        variants: product.variants,
      },
      variantId,
      variant.price / 100 // Convert cents to dollars for display
    )

    showToast(`${product.title} added to cart!`, 'success')
    // Clear variant selection after adding
    setSelectedVariants(prev => ({
      ...prev,
      [product.id]: '',
    }))
  }

  const handleVariantSelect = (productId: string, variantId: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: variantId,
    }))
  }

  if (loadingState === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="section" style={{ flex: 1 }}>
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
      </div>
    )
  }

  if (loadingState === 'loading' || !storefront) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading storefront…</p>
        </div>
      </div>
    )
  }

  const primaryColor = storefront.primaryColor
  const secondaryColor = storefront.secondaryColor

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(to bottom, ${secondaryColor}05, transparent)` }}>
      {/* Brand Header */}
      <div
        style={{
          background: primaryColor,
          color: '#fff',
          padding: '48px 24px',
          marginBottom: '60px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="container">
          {/* Header Top Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              {storefront.logoUrl ? (
                <img
                  src={storefront.logoUrl}
                  alt={storefront.companyName}
                  style={{
                    width: '56px',
                    height: '56px',
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                  onError={e => {
                    (e.target as HTMLImageElement).style.filter = 'none'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                  }}
                >
                  {storefront.companyName.charAt(0)}
                </div>
              )}
              <div>
                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                  {storefront.companyName}
                </h1>
                <p style={{ margin: '4px 0 0', opacity: 0.95, fontSize: '15px' }}>
                  Team & Culture Swag Store
                </p>
              </div>
            </div>

            <Link
              href={`/cart?domain=${encodeURIComponent(domain)}`}
              className="btn btn-secondary"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.25)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.15)'
              }}
            >
              {cartCount > 0 && (
                <span
                  style={{
                    background: 'var(--color-danger)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {cartCount}
                </span>
              )}
              Cart {cartCount > 0 && `(${cartCount})`}
            </Link>
          </div>

          {/* Hero Message */}
          <div style={{ maxWidth: '600px' }}>
            <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, opacity: 0.95 }}>
              Browse our curated selection of branded merchandise. Free for all team members — express your company culture!
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container" style={{ marginBottom: '80px' }}>
        {storefront.products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p className="text-h2">No items available yet</p>
            <p className="text-muted">Check back soon for our product lineup</p>
          </div>
        ) : (
          <>
            {/* Products Header */}
            <div style={{ marginBottom: '32px' }}>
              <h2 className="text-h2" style={{ marginBottom: '8px' }}>
                Featured Items
              </h2>
              <p className="text-muted">
                {storefront.products.length} product{storefront.products.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Products Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px',
              }}
            >
              {storefront.products.map(product => (
                <div
                  key={product.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    border: `1px solid var(--color-border)`,
                  }}
                  onMouseEnter={e => {
                    const card = e.currentTarget as HTMLElement
                    card.style.boxShadow = 'var(--shadow-elevated)'
                    card.style.transform = 'translateY(-4px)'
                  }}
                  onMouseLeave={e => {
                    const card = e.currentTarget as HTMLElement
                    card.style.boxShadow = 'var(--shadow-card)'
                    card.style.transform = 'none'
                  }}
                >
                  {/* Product Image */}
                  <div
                    style={{
                      width: '100%',
                      height: '240px',
                      background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}08)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      borderBottom: `1px solid var(--color-border)`,
                    }}
                  >
                    <img
                      src={product.mockupImage || product.image}
                      alt={product.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={e => {
                        (e.target as HTMLImageElement).src = product.image
                      }}
                    />
                  </div>

                  {/* Product Details */}
                  <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3
                      className="text-h3"
                      style={{
                        marginBottom: '8px',
                        marginTop: 0,
                        color: 'var(--color-text)',
                      }}
                    >
                      {product.title}
                    </h3>

                    <p
                      className="text-small text-muted"
                      style={{
                        marginBottom: '16px',
                        flex: 1,
                      }}
                    >
                      {product.description}
                    </p>

                    {/* Category Badge */}
                    {product.category && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          background: `${primaryColor}12`,
                          color: primaryColor,
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          marginBottom: '12px',
                          width: 'fit-content',
                        }}
                      >
                        {product.category}
                      </div>
                    )}

                    {/* Variant Selection */}
                    <div style={{ marginBottom: '16px' }}>
                      <label
                        htmlFor={`variant-${product.id}`}
                        className="text-small font-semibold"
                        style={{
                          display: 'block',
                          marginBottom: '8px',
                          color: 'var(--color-text)',
                        }}
                      >
                        Size / Option
                      </label>
                      <select
                        id={`variant-${product.id}`}
                        value={selectedVariants[product.id] || ''}
                        onChange={e => handleVariantSelect(product.id, e.target.value)}
                        className="input-field"
                        style={{ marginBottom: 0 }}
                      >
                        <option value="">Select an option</option>
                        {product.variants.map(variant => (
                          <option key={variant.id} value={variant.id}>
                            {variant.title} — ${(variant.price / 100).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="btn btn-primary btn-full"
                      style={{
                        background: primaryColor,
                        marginTop: 'auto',
                      }}
                      onMouseEnter={e => {
                        const btn = e.currentTarget as HTMLElement
                        btn.style.opacity = '0.9'
                      }}
                      onMouseLeave={e => {
                        const btn = e.currentTarget as HTMLElement
                        btn.style.opacity = '1'
                      }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={toast.type === 'success' ? 'toast success-banner' : 'toast error-banner'}
        >
          {toast.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default async function StorefrontPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading storefront…</p>
        </div>
      </div>
    }>
      <StorefrontContent domain={domain} />
    </Suspense>
  )
}
