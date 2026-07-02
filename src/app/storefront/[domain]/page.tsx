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
  const { addToCart } = useCart()

  const domain = normalizeDomain(paramDomain)

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

  const handleAddToCart = (product: StorefrontProduct) => {
    const variantId = selectedVariants[product.id]
    if (!variantId) {
      alert('Please select a size/option')
      return
    }

    const variant = product.variants.find(v => v.id === variantId)
    if (!variant) {
      alert('Invalid variant selected')
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

    alert(`${product.title} added to cart!`)
  }

  const handleVariantSelect = (productId: string, variantId: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: variantId,
    }))
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

  if (loadingState === 'loading' || !storefront) {
    return (
      <div className="section">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading storefront…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: storefront.secondaryColor }}>
      {/* Header */}
      <div
        style={{
          background: storefront.primaryColor,
          color: '#fff',
          padding: '40px 20px',
          marginBottom: '40px',
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {storefront.logoUrl ? (
                <img
                  src={storefront.logoUrl}
                  alt={storefront.companyName}
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '4px',
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
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                  {storefront.companyName} Swag
                </h1>
                <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                  Exclusive merch for our team
                </p>
              </div>
            </div>

            <Link href={`/cart?domain=${encodeURIComponent(domain)}`} className="btn btn-secondary">
              View Cart
            </Link>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container" style={{ marginBottom: '60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
          {storefront.products.map(product => (
            <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Product Image */}
              <div
                style={{
                  width: '100%',
                  height: '200px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={product.mockupImage || product.image}
                  alt={product.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Product Info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 className="text-h3" style={{ marginBottom: '8px', marginTop: 0 }}>
                  {product.title}
                </h3>

                <p className="text-small text-muted" style={{ marginBottom: '12px', flex: 1 }}>
                  {product.description}
                </p>

                {/* Variant Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="text-small font-semibold text-muted" style={{ display: 'block', marginBottom: '8px' }}>
                    Size/Option
                  </label>
                  <select
                    value={selectedVariants[product.id] || ''}
                    onChange={e => handleVariantSelect(product.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select option</option>
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
                  style={{}}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function StorefrontPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <StorefrontContent domain={domain} />
    </Suspense>
  )
}
