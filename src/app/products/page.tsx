'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizeDomain } from '@/lib/brand'
import { ProductCard, type Product, type ProductVariant } from '@/components/ProductCard'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

interface BrandData {
  id: string
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
}

interface ProductsResponse {
  products: Product[]
  count: number
  primaryColor?: string
  secondaryColor?: string
}

function ProductsForm() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') || ''
  const domainSubmissionId = searchParams.get('id') || ''

  const [brand, setBrand] = useState<BrandData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Fetch brand data from Supabase via API
  const fetchBrandData = async (domain: string) => {
    try {
      const res = await fetch(`/api/brand?domain=${encodeURIComponent(domain)}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch brand data: ${res.statusText}`)
      }
      const data = await res.json()
      // Reconstruct the BrandData object from the brand preview response
      setBrand({
        id: domainSubmissionId || `brand-${domain}`,
        domain,
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

  // Fetch products from /api/printify/products
  const fetchProducts = async (domain: string, primaryColor: string, secondaryColor: string, companyName: string, logoUrl: string | null) => {
    try {
      const params = new URLSearchParams({
        domain,
        primaryColor,
        secondaryColor,
        companyName,
        ...(logoUrl && { logoUrl }),
      })
      const res = await fetch(`/api/printify/products?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.statusText}`)
      }
      const data: ProductsResponse = await res.json()
      setProducts(data.products)
      setLoadingState('loaded')
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : 'Failed to load products')
      setLoadingState('error')
    }
  }

  // Load brand and products on mount
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

    // Fetch brand data first
    fetchBrandData(norm)
  }, [domain, domainSubmissionId])

  // Fetch products once brand data is available
  useEffect(() => {
    if (brand && loadingState === 'loading') {
      fetchProducts(
        brand.domain,
        brand.primary_color,
        brand.secondary_color,
        brand.company_name,
        brand.logo_url
      )
    }
  }, [brand, loadingState])

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProductIds)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProductIds(newSelected)
  }

  const handleCreateStore = async () => {
    if (!brand || selectedProductIds.size < 4) {
      return
    }

    // Navigate to preview page with selected products
    const selectedProductIdArray = Array.from(selectedProductIds).join(',')
    const previewUrl = `/preview?domain=${encodeURIComponent(brand.domain)}&id=${encodeURIComponent(brand.id)}&products=${encodeURIComponent(selectedProductIdArray)}`
    window.location.href = previewUrl
  }

  const selectedCount = selectedProductIds.size

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Select Your Swag
          </h1>
          <p className="text-body text-muted">
            Choose at least 4 branded products for your team.
          </p>
        </div>

        {/* Error states */}
        {loadingState === 'error' && (
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {loadingError}
          </div>
        )}

        {/* Main content */}
        {loadingState === 'loaded' && brand ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
            {/* Products list */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedProductIds.has(product.id)}
                    onToggle={() => handleToggleProduct(product.id)}
                    variant="selectable"
                  />
                ))}
              </div>
            </div>

            {/* Sidebar - Brand preview & action */}
            <div style={{ position: 'sticky', top: '20px' }}>
              {/* Brand card */}
              <div className="card" style={{ marginBottom: '24px' }}>
                {/* Logo */}
                <div
                  style={{
                    width: '100%',
                    height: '100px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    overflow: 'hidden',
                  }}
                >
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={`${brand.company_name} logo`}
                      style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: brand.primary_color }}>
                      {brand.company_name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="text-h3" style={{ marginBottom: '4px' }}>
                  {brand.company_name}
                </div>
                <div className="text-small text-muted" style={{ marginBottom: '16px' }}>
                  {brand.domain}
                </div>

                {/* Colors */}
                <div style={{ marginBottom: '16px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Colors
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: 'var(--radius-sm)',
                          background: brand.primary_color,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                      <div className="text-small" style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                        {brand.primary_color}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: 'var(--radius-sm)',
                          background: brand.secondary_color,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                      <div className="text-small" style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                        {brand.secondary_color}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selection counter */}
              <div className="card" style={{ marginBottom: '16px', borderColor: selectedCount >= 4 ? 'var(--color-accent)' : 'var(--color-border)' }}>
                <div className="text-small text-muted" style={{ marginBottom: '8px' }}>
                  Products selected
                </div>
                <div className="text-h2" style={{ marginBottom: '4px' }}>
                  {selectedCount}/{products.length}
                </div>
                <div className="text-small text-muted">
                  {selectedCount < 4 ? `${4 - selectedCount} more needed` : 'Ready to create!'}
                </div>
              </div>

              {/* Preview store button */}
              <button
                onClick={handleCreateStore}
                disabled={selectedCount < 4}
                className="btn btn-primary btn-full"
                style={{
                  opacity: selectedCount < 4 ? 0.5 : 1,
                  cursor: selectedCount < 4 ? 'not-allowed' : 'pointer',
                }}
              >
                <>
                  Preview & Customize
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </>
              </button>

              {/* Back link */}
              <a
                href={`/onboard?domain=${encodeURIComponent(brand.domain)}`}
                className="btn btn-secondary btn-full"
                style={{ marginTop: '12px' }}
              >
                Back
              </a>
            </div>
          </div>
        ) : loadingState === 'loading' ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
            <p className="text-body text-muted">Loading products…</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ProductsForm />
    </Suspense>
  )
}
