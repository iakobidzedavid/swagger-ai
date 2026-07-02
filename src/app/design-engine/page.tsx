'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface BrandAsset {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  companyName: string
  domain: string
  source: string
}

interface ProductData {
  id: string
  title: string
  description: string
  category: string
  image: string
  mockupImage?: string
  variants: Array<{ id: string; title: string; price: number }>
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

interface MockupData {
  domain: string
  companyName: string
  brandAssets: BrandAsset
  mockupUrl: string
  shareableUrl: string
  products?: ProductData[]
}

function DesignEngineContent() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') ?? ''

  const [mockup, setMockup] = useState<MockupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (!domain) {
      setError('No domain provided')
      setLoading(false)
      return
    }

    const fetchMockup = async () => {
      try {
        const response = await fetch(`/api/design-engine/mockup?domain=${encodeURIComponent(domain)}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch mockup: ${response.statusText}`)
        }
        const data = (await response.json()) as MockupData
        setMockup(data)

        // Generate QR code
        try {
          const qrUrl = await QRCode.toDataURL(data.shareableUrl, { width: 200 })
          setQrDataUrl(qrUrl)
        } catch (qrError) {
          console.warn('QR code generation failed:', qrError)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchMockup()
  }, [domain])

  const handleCopyLink = async () => {
    if (mockup?.shareableUrl) {
      try {
        await navigator.clipboard.writeText(mockup.shareableUrl)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: '#0d1f33' }}>
        <p style={{ color: '#ecebf3' }}>Loading design preview...</p>
      </div>
    )
  }

  if (error || !mockup) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: '#0d1f33' }}>
        <p style={{ color: '#e74c3c' }}>Error: {error || 'No mockup data'}</p>
      </div>
    )
  }

  const { brandAssets } = mockup

  return (
    <div style={{ minHeight: '100vh', background: brandAssets.primaryColor + '0f' }}>
      {/* Header Bar */}
      <div
        style={{
          background: brandAssets.primaryColor,
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Design Preview</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleCopyLink}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {copiedLink ? '✓ Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: '40px',
          }}
        >
          {/* Main Storefront Preview */}
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {/* Storefront Header */}
            <div
              style={{
                background: brandAssets.primaryColor,
                padding: '30px 20px',
                textAlign: 'center',
                color: '#fff',
              }}
            >
              {brandAssets.logoUrl ? (
                <img
                  src={brandAssets.logoUrl}
                  alt={brandAssets.companyName}
                  style={{
                    maxWidth: '120px',
                    height: 'auto',
                    marginBottom: '16px',
                  }}
                />
              ) : (
                <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>
                  {brandAssets.companyName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <h1 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>
                {brandAssets.companyName} Store
              </h1>
              <p style={{ margin: '0', opacity: 0.9 }}>Branded employee swag</p>
            </div>

            {/* Products Grid */}
            <div style={{ padding: '30px' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: brandAssets.primaryColor }}>
                Featured Products
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '20px',
                }}
              >
                {mockup?.products && mockup.products.length > 0 ? (
                  mockup.products.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        border: `1px solid ${brandAssets.secondaryColor}`,
                        borderRadius: '6px',
                        overflow: 'hidden',
                        transition: 'transform 0.2s',
                      }}
                    >
                      {/* Product Image — Branded Mockup */}
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${brandAssets.primaryColor}0a, ${brandAssets.secondaryColor}0a)`,
                          height: '240px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '36px',
                          fontWeight: 'bold',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {product.mockupImage ? (
                          <img
                            src={product.mockupImage}
                            alt={product.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <span style={{ zIndex: 1, opacity: 0.5 }}>
                            {product.title.slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#333' }}>
                          {product.title}
                        </h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
                          SKU: {product.sku}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: brandAssets.primaryColor }}>
                            ${product.variants?.[0]?.price ?? 'TBD'}
                          </span>
                          <button
                            style={{
                              background: brandAssets.primaryColor,
                              color: '#fff',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                    <p>Loading product catalog...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                background: '#f5f5f5',
                padding: '20px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#666',
                borderTop: `1px solid ${brandAssets.secondaryColor}`,
              }}
            >
              Powered by Swagger AI • {new Date().getFullYear()}
            </div>
          </div>

          {/* Right Panel: Brand Info & QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Brand Info Card */}
            <div
              style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                Brand Assets
              </h3>

              {/* Logo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Logo
                </label>
                <div
                  style={{
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {brandAssets.logoUrl ? (
                    <img
                      src={brandAssets.logoUrl}
                      alt="Logo"
                      style={{ maxWidth: '90%', maxHeight: '90%' }}
                    />
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>No logo found</span>
                  )}
                </div>
              </div>

              {/* Color Swatches */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Primary Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      background: brandAssets.primaryColor,
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                    }}
                  />
                  <code style={{ fontSize: '12px', color: '#666' }}>
                    {brandAssets.primaryColor}
                  </code>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Secondary Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      background: brandAssets.secondaryColor,
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                    }}
                  />
                  <code style={{ fontSize: '12px', color: '#666' }}>
                    {brandAssets.secondaryColor}
                  </code>
                </div>
              </div>

              {/* Domain Info */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Domain
                </label>
                <code
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '3px',
                    wordBreak: 'break-all',
                  }}
                >
                  {brandAssets.domain}
                </code>
              </div>
            </div>

            {/* QR Code Card */}
            {qrDataUrl && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                  Share Mockup
                </h3>
                <img src={qrDataUrl} alt="QR Code" style={{ maxWidth: '100%', borderRadius: '4px' }} />
                <p
                  style={{
                    margin: '12px 0 0 0',
                    fontSize: '11px',
                    color: '#999',
                  }}
                >
                  Scan to share with prospects
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DesignEngineSuspense() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: '#0d1f33' }}>
      <p style={{ color: '#ecebf3' }}>Loading...</p>
    </div>}>
      <DesignEngineContent />
    </Suspense>
  )
}

export default DesignEngineSuspense
