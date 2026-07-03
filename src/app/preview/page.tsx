'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizeDomain } from '@/lib/brand'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'
type CreatingState = 'idle' | 'creating' | 'success' | 'error'

interface BrandData {
  id: string
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
}

interface Product {
  id: string
  title: string
  description: string
  category: string
  image: string
  mockupImage?: string
  variants: Array<{ id: string; title: string; price: number }>
  sku: string
}

interface DesignTemplate {
  id: string
  name: string
  description: string
  hero_style: 'minimal' | 'bold' | 'gradient' | 'image' | 'solid'
  product_grid_cols: 2 | 3 | 4
  use_gradient: boolean
  cta_style: 'rounded' | 'sharp' | 'pill'
}

const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simple, and focused',
    hero_style: 'minimal',
    product_grid_cols: 3,
    use_gradient: false,
    cta_style: 'rounded',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High-contrast and eye-catching',
    hero_style: 'bold',
    product_grid_cols: 2,
    use_gradient: true,
    cta_style: 'pill',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional and refined',
    hero_style: 'solid',
    product_grid_cols: 4,
    use_gradient: false,
    cta_style: 'sharp',
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Dynamic and playful',
    hero_style: 'gradient',
    product_grid_cols: 3,
    use_gradient: true,
    cta_style: 'rounded',
  },
]

function PreviewContent() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''
  const brandId = searchParams.get('id') || ''
  const productIdsParam = searchParams.get('products') || ''

  const [brand, setBrand] = useState<BrandData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('minimal')
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [creatingState, setCreatingState] = useState<CreatingState>('idle')
  const [creatingError, setCreatingError] = useState<string | null>(null)

  const selectedProductIds = new Set(productIdsParam.split(',').filter(id => id))
  const selectedProducts = products.filter(p => selectedProductIds.has(p.id))
  const template = DESIGN_TEMPLATES.find(t => t.id === selectedTemplate) || DESIGN_TEMPLATES[0]

  // Fetch brand data
  useEffect(() => {
    if (!domain) {
      setLoadingError('No domain provided')
      setLoadingState('error')
      return
    }

    const norm = normalizeDomain(domain)
    if (!norm) {
      setLoadingError('Invalid domain format')
      setLoadingState('error')
      return
    }

    const fetchBrandData = async () => {
      try {
        const res = await fetch(`/api/brand?domain=${encodeURIComponent(norm)}`)
        if (!res.ok) {
          throw new Error('Failed to fetch brand data')
        }
        const data = await res.json()
        setBrand({
          id: brandId || `brand-${norm}`,
          domain: norm,
          company_name: data.companyName,
          logo_url: data.logoUrl,
          primary_color: data.primaryColor,
          secondary_color: data.secondaryColor,
        })
      } catch (err) {
        setLoadingError(err instanceof Error ? err.message : 'Failed to load brand data')
        setLoadingState('error')
      }
    }

    fetchBrandData()
  }, [domain, brandId])

  // Fetch products
  useEffect(() => {
    if (!brand) return

    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({
          domain: brand.domain,
          primaryColor: brand.primary_color,
          secondaryColor: brand.secondary_color,
          companyName: brand.company_name,
          ...(brand.logo_url && { logoUrl: brand.logo_url }),
        })
        const res = await fetch(`/api/printify/products?${params}`)
        if (!res.ok) {
          throw new Error('Failed to fetch products')
        }
        const data = await res.json()
        setProducts(data.products)
        setLoadingState('loaded')
      } catch (err) {
        setLoadingError(err instanceof Error ? err.message : 'Failed to load products')
        setLoadingState('error')
      }
    }

    fetchProducts()
  }, [brand])

  const handleCreateStore = async () => {
    if (!brand) return

    setCreatingState('creating')
    setCreatingError(null)

    try {
      const res = await fetch('/api/storefront/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainSubmissionId: brand.id,
          domain: brand.domain,
          companyName: brand.company_name,
          logoUrl: brand.logo_url,
          primaryColor: brand.primary_color,
          secondaryColor: brand.secondary_color,
          designTemplate: selectedTemplate,
          products: selectedProducts.map(p => ({
            productId: p.id,
            productName: p.title,
            productCategory: p.category,
            productImage: p.mockupImage || p.image,
            productPrice: p.variants[0]?.price || 0,
            productSku: p.sku,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create storefront')
      }

      const storefrontRequestId = data.storefrontRequest?.id

      setCreatingState('success')
      // Redirect to products created page to show and sync products
      setTimeout(() => {
        if (storefrontRequestId) {
          window.location.href = `/products-created?storefrontRequestId=${encodeURIComponent(storefrontRequestId)}`
        } else {
          window.location.href = `/store-created?domain=${encodeURIComponent(brand.domain)}`
        }
      }, 1500)
    } catch (err) {
      setCreatingState('error')
      setCreatingError(err instanceof Error ? err.message : 'Failed to create storefront')
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
            {loadingError}
          </div>
          <a href="/products" className="btn btn-secondary btn-full">
            Back to Products
          </a>
        </div>
      </div>
    )
  }

  if (loadingState === 'loading') {
    return (
      <div className="section">
        <div className="container content-narrow" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p className="text-body text-muted">Loading store preview…</p>
        </div>
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="section">
        <div className="container content-narrow">
          <div className="error-banner">
            No brand data available
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            {creatingState === 'success' ? 'Store Created!' : 'Preview Your Store'}
          </h1>
          <p className="text-body text-muted">
            {creatingState === 'success'
              ? 'Your storefront is ready. Redirecting…'
              : 'Choose a design template and preview how your storefront will look.'}
          </p>
        </div>

        {creatingError && (
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {creatingError}
          </div>
        )}

        {creatingState === 'success' && (
          <div className="success-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Store created successfully!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
          {/* Main Preview Area */}
          <div>
            {/* Store Preview */}
            <div
              className="card"
              style={{
                marginBottom: '32px',
                background: 'var(--color-on-accent)',
                overflow: 'hidden',
                minHeight: '500px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Hero Section */}
              <div
                style={{
                  padding: '48px 32px',
                  background: template.use_gradient
                    ? `linear-gradient(135deg, ${brand.primary_color}15 0%, ${brand.secondary_color}15 100%)`
                    : brand.primary_color + '08',
                  borderBottom: `1px solid var(--color-border)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                  {brand.logo_url && (
                    <img
                      src={brand.logo_url}
                      alt={brand.company_name}
                      style={{ width: '50px', height: '50px', objectFit: 'contain' }}
                    />
                  )}
                  <div>
                    <h2 style={{ margin: 0, color: brand.primary_color, fontSize: '24px', fontWeight: 600 }}>
                      {brand.company_name}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-canvas-text-muted)', fontSize: '14px' }}>
                      Team & Culture Swag
                    </p>
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--color-canvas-text)', fontSize: '16px', lineHeight: 1.6, maxWidth: '500px' }}>
                  Browse our curated selection of branded merchandise. Each item has been carefully chosen to represent our brand.
                </p>
              </div>

              {/* Products Grid */}
              <div style={{ padding: '32px', flex: 1 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${template.product_grid_cols}, 1fr)`,
                    gap: '24px',
                  }}
                >
                  {selectedProducts.slice(0, 8).map(product => (
                    <div
                      key={product.id}
                      style={{
                        textAlign: 'center',
                        borderRadius: template.cta_style === 'pill' ? '16px' : '8px',
                        overflow: 'hidden',
                        border: `1px solid var(--color-canvas-border-light)`,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)'
                        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                        ;(e.currentTarget as HTMLElement).style.transform = 'none'
                      }}
                    >
                      {/* Product Image */}
                      <div
                        style={{
                          width: '100%',
                          height: '180px',
                          background: `linear-gradient(135deg, ${brand.primary_color}10 0%, ${brand.secondary_color}10 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={product.mockupImage || product.image}
                          alt={product.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = product.image
                          }}
                        />
                      </div>

                      {/* Product Info */}
                      <div style={{ padding: '16px' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-canvas-text-strong)' }}>
                          {product.title}
                        </h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--color-canvas-text-muted)' }}>
                          {product.description}
                        </p>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                          }}
                        >
                          <span style={{ fontSize: '14px', fontWeight: 600, color: brand.primary_color }}>
                            ${product.variants[0]?.price || 0}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--color-canvas-text-subtle)' }}>
                            {product.sku}
                          </span>
                        </div>
                        <button
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: brand.primary_color,
                            color: 'var(--color-on-accent)',
                            border: 'none',
                            borderRadius: template.cta_style === 'pill' ? '20px' : template.cta_style === 'sharp' ? '2px' : '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            ;(e.target as HTMLElement).style.opacity = '0.9'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.target as HTMLElement).style.opacity = '1'
                          }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Count Info */}
            <div className="card" style={{ marginBottom: '24px', textAlign: 'center' }}>
              <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
                Total Products in Your Store
              </p>
              <div className="text-h2">{selectedProducts.length}</div>
            </div>
          </div>

          {/* Sidebar - Design Selection */}
          <div>
            {/* Design Templates */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="text-small font-semibold text-muted" style={{ marginBottom: '16px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Design Template
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DESIGN_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    style={{
                      padding: '12px',
                      background: selectedTemplate === t.id ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: selectedTemplate === t.id ? 'var(--color-on-accent)' : 'var(--color-text)',
                      border: `2px solid ${selectedTemplate === t.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTemplate !== t.id) {
                        (e.target as HTMLElement).style.background = 'var(--color-bg)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTemplate !== t.id) {
                        (e.target as HTMLElement).style.background = 'var(--color-surface)'
                      }
                    }}
                  >
                    <div className="text-small font-semibold">{t.name}</div>
                    <div className="text-small text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Info */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="text-small font-semibold text-muted" style={{ marginBottom: '12px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Brand
              </div>
              {brand.logo_url && (
                <div
                  style={{
                    width: '100%',
                    height: '60px',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={brand.logo_url}
                    alt={brand.company_name}
                    style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div className="text-h3" style={{ marginBottom: '4px' }}>
                {brand.company_name}
              </div>
              <div className="text-small text-muted">{brand.domain}</div>

              {/* Colors */}
              <div style={{ marginTop: '16px' }}>
                <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  Colors
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: brand.primary_color,
                        border: '1px solid var(--color-border)',
                        marginBottom: '4px',
                      }}
                    />
                    <div className="text-small" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {brand.primary_color}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: brand.secondary_color,
                        border: '1px solid var(--color-border)',
                        marginBottom: '4px',
                      }}
                    />
                    <div className="text-small" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {brand.secondary_color}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleCreateStore}
              disabled={creatingState === 'creating' || creatingState === 'success'}
              className="btn btn-primary btn-full"
              style={{ marginBottom: '12px' }}
            >
              {creatingState === 'creating' ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Creating…
                </>
              ) : creatingState === 'success' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Created!
                </>
              ) : (
                <>
                  Create Store
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </>
              )}
            </button>

            <a
              href={`/products?domain=${encodeURIComponent(brand.domain)}&id=${encodeURIComponent(brand.id)}`}
              className="btn btn-secondary btn-full"
            >
              Back
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <PreviewContent />
    </Suspense>
  )
}
