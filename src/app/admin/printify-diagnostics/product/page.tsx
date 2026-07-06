'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

interface PrintifyVariant {
  id: number
  title: string
  price: number
  is_enabled?: boolean
  is_default?: boolean
}

interface PrintifyImage {
  src: string
  variant_ids?: number[]
  position?: string
  is_default?: boolean
}

interface PrintifyProductRecord {
  id: string
  title: string
  description?: string
  images?: PrintifyImage[]
  variants?: PrintifyVariant[]
  visible?: boolean
  blueprint_id?: number
  print_provider_id?: number
}

function ProductDetail() {
  const params = useSearchParams()
  const shopId = params.get('shopId')
  const productId = params.get('productId')

  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [product, setProduct] = useState<PrintifyProductRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shopId || !productId) {
      setState('error')
      setError('Missing shopId or productId')
      return
    }
    async function load() {
      try {
        const res = await fetch(`/api/admin/printify-diagnostics/product?shopId=${shopId}&productId=${productId}`)
        const data = await res.json()
        if (!res.ok || data.error) {
          setState('error')
          setError(data.error || `HTTP ${res.status}`)
          return
        }
        setProduct(data.product)
        setState('loaded')
      } catch (err) {
        setState('error')
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    load()
  }, [shopId, productId])

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <Link href="/admin/printify-diagnostics" className="text-muted" style={{ fontSize: '0.85rem' }}>
        ← Back to diagnostics
      </Link>

      {state === 'loading' && <p className="text-muted" style={{ marginTop: '24px' }}>Loading live Printify product…</p>}

      {state === 'error' && (
        <div className="card" style={{ marginTop: '24px', padding: '16px', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {state === 'loaded' && product && (
        <div style={{ marginTop: '24px' }}>
          <h1 className="text-display" style={{ marginBottom: '4px' }}>{product.title}</h1>
          <p className="text-muted" style={{ marginBottom: '24px' }}>
            Printify product ID: <code>{product.id}</code> · Shop #{shopId}
          </p>

          {product.description && (
            <p className="text-body" style={{ marginBottom: '24px' }}>{product.description}</p>
          )}

          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Print-ready mockups (live from Printify)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {(product.images || []).map((img, idx) => (
              <a key={idx} href={img.src} target="_blank" rel="noopener noreferrer" className="card" style={{ padding: '8px' }}>
                <img src={img.src} alt={`${product.title} mockup ${idx}`} style={{ width: '100%', height: '160px', objectFit: 'contain', backgroundColor: '#fff' }} />
              </a>
            ))}
            {(!product.images || product.images.length === 0) && (
              <p className="text-muted">No mockup images returned for this product.</p>
            )}
          </div>

          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Variants & pricing (live from Printify)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Variant</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Price</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {(product.variants || []).map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', fontSize: '0.85rem' }}>{v.title}</td>
                  <td style={{ padding: '8px', fontSize: '0.85rem' }}>${(v.price / 100).toFixed(2)}</td>
                  <td style={{ padding: '8px', fontSize: '0.85rem' }}>{v.is_enabled ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div className="container"><p className="text-muted" style={{ paddingTop: '40px' }}>Loading…</p></div>}>
      <ProductDetail />
    </Suspense>
  )
}
