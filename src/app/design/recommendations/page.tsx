'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, useRef } from 'react'

interface DesignRecommendation {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  colorPalette: string[]
  accentColors: string[]
  fonts: string[]
  guidelines: string[]
}

function ColorSwatch({
  color,
  label,
  onClick,
}: {
  color: string
  label: string
  onClick: () => void
}) {
  return (
    <div
      className="color-swatch-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {onClick()}
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          background: color,
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      />
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        <code
          style={{
            fontSize: '11px',
            color: 'var(--color-text)',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {color}
        </code>
      </div>
    </div>
  )
}

function DesignRecommendationsContent() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain') ?? ''
  const [recommendations, setRecommendations] = useState<DesignRecommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedColor, setCopiedColor] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!domain) {
      setError('No domain provided')
      setLoading(false)
      return
    }

    const fetchRecommendations = async () => {
      try {
        const response = await fetch(
          `/api/design/recommendations?domain=${encodeURIComponent(domain)}`,
        )
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch recommendations')
        }
        const data = (await response.json()) as DesignRecommendation
        setRecommendations(data)
        setError(null)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch design recommendations',
        )
        setRecommendations(null)
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [domain])

  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color).catch(() => null)
    setCopiedColor(color)
    if (copyTimeoutRef.current) {clearTimeout(copyTimeoutRef.current)}
    copyTimeoutRef.current = setTimeout(() => setCopiedColor(null), 2000)
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text)', fontSize: '18px' }}>
            Loading design recommendations...
          </p>
        </div>
      </div>
    )
  }

  if (error || !recommendations) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-danger)', fontSize: '16px' }}>
            {error || 'No design recommendations available'}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '12px' }}>
            {error
              ? 'Please submit your domain on the onboard page first.'
              : 'Try submitting your domain again.'}
          </p>
        </div>
      </div>
    )
  }

  const { colorPalette, accentColors, fonts, guidelines } = recommendations

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            {recommendations.logoUrl && (
              <img
                src={recommendations.logoUrl}
                alt={recommendations.companyName}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '6px',
                }}
              />
            )}
            <div>
              <h1 style={{ margin: '0 0 8px 0', color: 'var(--color-text)', fontSize: '32px' }}>
                {recommendations.companyName} Design Kit
              </h1>
              <p style={{ margin: '0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                {recommendations.domain}
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
          }}
        >
          {/* Primary & Secondary Colors */}
          <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
            <h2
              style={{
                margin: '0 0 20px 0',
                color: 'var(--color-text)',
                fontSize: '18px',
                fontWeight: '600',
              }}
            >
              Brand Colors
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ColorSwatch
                color={recommendations.primaryColor}
                label="Primary Color"
                onClick={() => handleCopyColor(recommendations.primaryColor)}
              />
              <ColorSwatch
                color={recommendations.secondaryColor}
                label="Secondary Color"
                onClick={() => handleCopyColor(recommendations.secondaryColor)}
              />
            </div>
            {copiedColor && (
              <p style={{ marginTop: '12px', color: 'var(--color-success-tint)', fontSize: '12px' }}>
                ✓ Color copied!
              </p>
            )}
          </div>

          {/* Full Palette */}
          {colorPalette.length > 2 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
              <h2
                style={{
                  margin: '0 0 20px 0',
                  color: 'var(--color-text)',
                  fontSize: '18px',
                  fontWeight: '600',
                }}
              >
                Color Palette
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                }}
              >
                {colorPalette.map((color, idx) => (
                  <div
                    key={color}
                    onClick={() => handleCopyColor(color)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        {handleCopyColor(color)}
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = 'translateY(-1px)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = 'none')
                    }
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        background: color,
                        borderRadius: '3px',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    />
                    <code
                      style={{
                        fontSize: '9px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        wordBreak: 'break-all',
                      }}
                    >
                      {color}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accent Colors */}
          {accentColors.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
              <h2
                style={{
                  margin: '0 0 20px 0',
                  color: 'var(--color-text)',
                  fontSize: '18px',
                  fontWeight: '600',
                }}
              >
                Accent Colors
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accentColors.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    label="Accent"
                    onClick={() => handleCopyColor(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fonts */}
          {fonts.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
              <h2
                style={{
                  margin: '0 0 20px 0',
                  color: 'var(--color-text)',
                  fontSize: '18px',
                  fontWeight: '600',
                }}
              >
                Recommended Fonts
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fonts.map((font, idx) => (
                  <div
                    key={`${font}-${idx}`}
                    style={{
                      padding: '12px',
                      background: 'var(--color-bg)',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <p
                      style={{
                        margin: '0',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: font,
                      }}
                    >
                      {font}
                    </p>
                    <code
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {font}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div
          style={{
            marginTop: '40px',
            background: 'var(--color-surface)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <h2
            style={{
              margin: '0 0 20px 0',
              color: 'var(--color-text)',
              fontSize: '18px',
              fontWeight: '600',
            }}
          >
            Design Guidelines
          </h2>
          <ul
            style={{
              margin: '0',
              padding: '0',
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {guidelines.map((guideline, idx) => (
              <li
                key={idx}
                style={{
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {guideline}
              </li>
            ))}
          </ul>
        </div>

        {/* Brand Source Info */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px 16px',
            background: 'var(--color-border)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          Source: {recommendations.source === 'brandfetch' && 'Brandfetch Brand Database'}
          {recommendations.source === 'favicon' &&
            'Logo Color Detection (Favicon)'}
          {recommendations.source === 'theme-color' && 'Meta Tag (theme-color)'}
          {recommendations.source === 'fallback' && 'Default Color'}
        </div>
      </div>
    </div>
  )
}

function DesignRecommendationsSuspense() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'var(--color-text)' }}>Loading...</p>
        </div>
      }
    >
      <DesignRecommendationsContent />
    </Suspense>
  )
}

export default DesignRecommendationsSuspense
