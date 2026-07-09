'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: string
}

interface GalleryBrand extends BrandData {
  isLoading?: boolean
  error?: string
}

// Sample domains from Step 9 prospects + other known SaaS companies
const SAMPLE_DOMAINS = [
  'linear.com',
  'retool.com',
  'vanta.com',
  'ramp.com',
  'ashby.com',
  'modal.com',
  'density.com',
  'census.com',
  'stripe.com',
  'slack.com',
]

const PRODUCT_SAMPLES = [
  { name: 'Classic T-Shirt', category: 'Apparel', image: '👕' },
  { name: 'Hoodie', category: 'Apparel', image: '🧥' },
  { name: 'Baseball Cap', category: 'Accessories', image: '🧢' },
  { name: 'Water Bottle', category: 'Drinkware', image: '💧' },
  { name: 'Sticker Pack', category: 'Accessories', image: '🎨' },
  { name: 'Tote Bag', category: 'Bags', image: '👜' },
]

async function fetchBrandData(domain: string): Promise<GalleryBrand> {
  try {
    const response = await fetch(`/api/brand?domain=${encodeURIComponent(domain)}`)
    if (!response.ok) {
      return {
        domain,
        companyName: domain.replace('.com', '').toUpperCase(),
        logoUrl: null,
        primaryColor: '#7c3aed',
        secondaryColor: '#a78bfa',
        source: 'fallback',
        error: 'Failed to load brand data',
      }
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching brand for ${domain}:`, error)
    return {
      domain,
      companyName: domain.replace('.com', '').toUpperCase(),
      logoUrl: null,
      primaryColor: '#7c3aed',
      secondaryColor: '#a78bfa',
      source: 'fallback',
      error: 'Network error',
    }
  }
}

function BrandCard({ brand }: { brand: GalleryBrand }) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Brand header with logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '20px',
        borderBottom: `1px solid var(--color-border)`,
      }}>
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={brand.companyName}
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              padding: '8px',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : null}
        <div>
          <h3 className="text-h3" style={{ marginBottom: '4px' }}>
            {brand.companyName}
          </h3>
          <p className="text-small text-muted" style={{ margin: 0 }}>
            {brand.domain}
          </p>
        </div>
      </div>

      {/* Brand colors */}
      <div style={{ marginBottom: '24px' }}>
        <p className="text-small" style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-muted)' }}>
          Brand Colors
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Primary color */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                width: '100%',
                height: '80px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: brand.primaryColor,
                border: `2px solid ${brand.primaryColor}`,
                marginBottom: '8px',
              }}
            />
            <p className="text-small text-muted" style={{ margin: '0 0 4px 0' }}>Primary</p>
            <code style={{
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--color-accent)',
              wordBreak: 'break-all',
            }}>
              {brand.primaryColor}
            </code>
          </div>

          {/* Secondary color */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                width: '100%',
                height: '80px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: brand.secondaryColor,
                border: `2px solid ${brand.secondaryColor}`,
                marginBottom: '8px',
              }}
            />
            <p className="text-small text-muted" style={{ margin: '0 0 4px 0' }}>Secondary</p>
            <code style={{
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--color-accent)',
              wordBreak: 'break-all',
            }}>
              {brand.secondaryColor}
            </code>
          </div>
        </div>
      </div>

      {/* Sample products grid */}
      <div>
        <p className="text-small" style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-muted)' }}>
          Sample Products
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}>
          {PRODUCT_SAMPLES.map((product, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg)',
                border: `1px solid var(--color-border)`,
                textAlign: 'center',
                fontSize: '24px',
              }}
              title={product.name}
            >
              {product.image}
            </div>
          ))}
        </div>
      </div>

      {/* CTA button */}
      <Link
        href={`/onboard?domain=${encodeURIComponent(brand.domain)}`}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: '20px' }}
      >
        Try this brand
      </Link>
    </div>
  )
}

export default function GalleryPage() {
  const [brands, setBrands] = useState<GalleryBrand[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadBrands = async () => {
      setIsLoading(true)
      const brandPromises = SAMPLE_DOMAINS.map(domain => fetchBrandData(domain))
      const results = await Promise.all(brandPromises)
      setBrands(results)
      setIsLoading(false)
    }

    loadBrands()
  }, [])

  return (
    <>
      {/* Hero section */}
      <section className="section" style={{ paddingTop: '100px', paddingBottom: '60px' }}>
        <div className="container content-narrow text-center">
          <span className="badge badge-accent" style={{ marginBottom: '16px', display: 'inline-block' }}>
            ✨ See Real Examples
          </span>

          <h1 className="text-display" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #ecebf3 0%, #a78bfa 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            Brand Sample Gallery
          </h1>

          <p className="text-body" style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', maxWidth: '520px', margin: '0 auto 32px', lineHeight: '1.7' }}>
            Explore real company brands and the products Swagger AI can generate for them. Choose a brand below and create your own branded storefront in minutes.
          </p>
        </div>
      </section>

      {/* Gallery section */}
      <section className="section">
        <div className="container">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <p className="text-body text-muted">Loading brand gallery...</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '48px',
            }}>
              {brands.map((brand) => (
                <BrandCard key={brand.domain} brand={brand} />
              ))}
            </div>
          )}

          {/* How it works section */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 24px',
            marginTop: '60px',
            textAlign: 'center',
          }}>
            <h2 className="text-h2" style={{ marginBottom: '24px' }}>
              Ready to create your own?
            </h2>
            <p className="text-body text-muted" style={{ marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
              Start with any domain above, or enter your own company domain to generate a branded storefront in under 5 minutes.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/onboard" className="btn btn-primary btn-lg">
                Create your storefront
              </Link>
              <Link href="/" className="btn btn-secondary btn-lg">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
