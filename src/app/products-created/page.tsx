'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ProductPhotoOverlay } from '@/components/ProductPhotoOverlay'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'
type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface BrandData {
  id: string
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  status: string
  createdAt: string
}

interface Product {
  id: string
  printifyId: string
  name: string
  description: string
  category: string
  imageUrl: string
  priceUsd: number
  sku: string
  status: 'active' | 'archived'
  brandColorPrimary: string
  brandColorSecondary: string
  createdAt: string
  lastSyncedAt?: string
}

interface ProductsCreatedResponse {
  success: boolean
  message: string
  storefront?: BrandData
  products: Product[]
  productCount: number
}

function ProductsCreatedContent() {
  const searchParams = useSearchParams()
  const storefrontRequestId = searchParams.get('storefrontRequestId') || ''

  const [storefront, setStorefront] = useState<BrandData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncingProductIds, setSyncingProductIds] = useState<Set<string>>(new Set())

  // Fetch created products
  useEffect(() => {
    if (!storefrontRequestId) {
      setLoadingError('No storefront ID provided')
      setLoadingState('error')
      return
    }

    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/printify/products-created?storefrontRequestId=${encodeURIComponent(storefrontRequestId)}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.statusText}`)
        }
        const data: ProductsCreatedResponse = await res.json()

        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch products')
        }

        if (data.storefront) {
          setStorefront(data.storefront)
        }
        setProducts(data.products || [])
        setLoadingState('loaded')
      } catch (err) {
        setLoadingError(err instanceof Error ? err.message : 'Failed to load products')
        setLoadingState('error')
      }
    }

    fetchProducts()
  }, [storefrontRequestId])

  const handleSyncProduct = async (productId: string, printifyId: string) => {
    if (!storefront) return

    setSyncingProductIds(new Set([...syncingProductIds, productId]))
    setSyncState('syncing')
    setSyncError(null)

    try {
      const res = await fetch('/api/printify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontRequestId,
          productId,
          printifyId,
          shopId: `mock-shop-${storefront.domain.replace(/\./g, '-')}`,
        }),
      })

      if (!res.ok) {
        throw new Error(`Sync failed: ${res.statusText}`)
      }

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || 'Sync failed')
      }

      // Update product in local state with new sync info
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                lastSyncedAt: new Date().toISOString(),
              }
            : p
        )
      )

      setSyncState('success')
      setTimeout(() => setSyncState('idle'), 2000)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
    } finally {
      setSyncingProductIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  const handleSyncAll = async () => {
    if (!storefront) return

    setSyncState('syncing')
    setSyncError(null)
    setSyncingProductIds(new Set(products.map((p) => p.id)))

    try {
      const res = await fetch('/api/printify/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontRequestId,
          shopId: `mock-shop-${storefront.domain.replace(/\./g, '-')}`,
        }),
      })

      if (!res.ok) {
        throw new Error(`Bulk sync failed: ${res.statusText}`)
      }

      const data = await res.json()
      if (!data.success && data.failedCount > 0) {
        setSyncError(`${data.failedCount} products failed to sync`)
      }

      // Refresh product list
      const refreshRes = await fetch(
        `/api/printify/products-created?storefrontRequestId=${encodeURIComponent(storefrontRequestId)}`
      )
      if (refreshRes.ok) {
        const refreshData: ProductsCreatedResponse = await refreshRes.json()
        if (refreshData.success) {
          setProducts(refreshData.products || [])
        }
      }

      setSyncState('success')
      setTimeout(() => setSyncState('idle'), 2000)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Bulk sync failed')
      setSyncState('error')
    } finally {
      setSyncingProductIds(new Set())
    }
  }

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="text-h1" style={{ marginBottom: '10px' }}>
            Products Created ✓
          </h1>
          <p className="text-body text-muted">
            {loadingState === 'loaded' && products.length > 0
              ? `${products.length} products ready for your storefront`
              : 'Manage and sync your created products'}
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

        {syncState === 'error' && syncError && (
          <div className="error-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {syncError}
          </div>
        )}

        {syncState === 'success' && (
          <div className="success-banner" style={{ marginBottom: '24px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sync completed successfully!
          </div>
        )}

        {/* Main content */}
        {loadingState === 'loaded' && storefront ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
            {/* Products grid */}
            <div>
              {products.length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          borderColor: product.status === 'active' ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                      >
                        {/* Product image */}
                        <div
                          style={{
                            width: '100%',
                            height: '160px',
                            background: 'linear-gradient(135deg, ' + product.brandColorPrimary + ', ' + product.brandColorSecondary + ')',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {product.imageUrl ? (
                            <ProductPhotoOverlay
                              imageUrl={product.imageUrl}
                              logoUrl={storefront?.logoUrl}
                              category={product.category}
                              alt={product.name}
                            />
                          ) : (
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-on-accent)', textAlign: 'center', padding: '16px' }}>
                              No image available
                            </span>
                          )}
                        </div>

                        {/* Product info */}
                        <div style={{ marginBottom: '12px', flex: 1 }}>
                          <div className="text-small font-semibold" style={{ marginBottom: '4px' }}>
                            {product.name}
                          </div>
                          <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                            {product.category}
                          </div>
                          <div className="text-small" style={{ color: 'var(--color-accent)', fontWeight: '600' }}>
                            ${product.priceUsd}
                          </div>
                        </div>

                        {/* Sync status */}
                        <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                          <div className="text-small text-muted" style={{ marginBottom: '2px' }}>
                            {product.lastSyncedAt ? `Last synced: ${new Date(product.lastSyncedAt).toLocaleDateString()}` : 'Pending sync'}
                          </div>
                          <div className="text-small" style={{ color: product.lastSyncedAt ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                            {product.lastSyncedAt ? '✓ Synced' : '◦ Not synced'}
                          </div>
                        </div>

                        {/* Sync button */}
                        <button
                          onClick={() => handleSyncProduct(product.id, product.printifyId)}
                          disabled={syncingProductIds.has(product.id) || syncState === 'syncing'}
                          className="btn btn-secondary btn-small btn-full"
                          style={{
                            opacity: syncingProductIds.has(product.id) ? 0.5 : 1,
                            cursor: syncingProductIds.has(product.id) ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {syncingProductIds.has(product.id) ? 'Syncing…' : 'Sync'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Action footer */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      paddingTop: '24px',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    <button
                      onClick={handleSyncAll}
                      disabled={syncState === 'syncing'}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        opacity: syncState === 'syncing' ? 0.5 : 1,
                        cursor: syncState === 'syncing' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {syncState === 'syncing' ? 'Syncing All…' : 'Sync All Products'}
                    </button>
                    <a href={`/store-created?domain=${encodeURIComponent(storefront.domain)}`} className="btn btn-secondary">
                      View Store
                    </a>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <p className="text-body text-muted">No products created yet</p>
                </div>
              )}
            </div>

            {/* Sidebar - Storefront info */}
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
                  {storefront.logoUrl ? (
                    <img
                      src={storefront.logoUrl}
                      alt={storefront.companyName}
                      style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: storefront.primaryColor }}>
                      {storefront.companyName.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="text-h3" style={{ marginBottom: '4px' }}>
                  {storefront.companyName}
                </div>
                <div className="text-small text-muted" style={{ marginBottom: '16px' }}>
                  {storefront.domain}
                </div>

                {/* Status badge */}
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: storefront.status === 'complete' ? 'var(--color-success-light)' : 'var(--color-info-light)',
                      color: storefront.status === 'complete' ? 'var(--color-success)' : 'var(--color-info-tint)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}
                  >
                    {storefront.status === 'complete' ? '✓ Complete' : storefront.status === 'partial' ? '⚠ Partial' : '◦ Processing'}
                  </div>
                </div>

                {/* Colors */}
                <div style={{ marginBottom: '16px' }}>
                  <div className="text-small font-semibold text-muted" style={{ marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Colors
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: '4px',
                          background: storefront.primaryColor,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                      <div className="text-small" style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                        {storefront.primaryColor}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: '4px',
                          background: storefront.secondaryColor,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                      <div className="text-small" style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                        {storefront.secondaryColor}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                  <div className="text-small text-muted" style={{ marginBottom: '4px' }}>
                    Total Products
                  </div>
                  <div className="text-h2" style={{ color: 'var(--color-accent)' }}>
                    {products.length}
                  </div>
                </div>
              </div>
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

export default function ProductsCreatedPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ProductsCreatedContent />
    </Suspense>
  )
}
