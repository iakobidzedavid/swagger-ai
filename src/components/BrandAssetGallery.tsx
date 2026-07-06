'use client'

import React, { useState } from 'react'

interface BrandAssets {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  colors?: string[]
  fonts?: string[]
}

interface BrandAssetGalleryProps {
  assets: BrandAssets
  onColorSelect?: (color: string) => void
  onSecondaryColorChange?: (color: string) => void
  onLogoError?: (failed: boolean) => void
  logoError?: boolean
  primaryColor?: string | null
  secondaryColor?: string | null
  userSelectedSecondaryColor?: string | null
}

export const BrandAssetGallery: React.FC<BrandAssetGalleryProps> = ({
  assets,
  onColorSelect,
  onSecondaryColorChange,
  onLogoError,
  logoError,
  primaryColor,
  secondaryColor,
  userSelectedSecondaryColor,
}) => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  const displayPrimaryColor = primaryColor || assets.primaryColor
  const displaySecondaryColor = userSelectedSecondaryColor || secondaryColor || assets.secondaryColor

  const copyHex = async (color: string) => {
    try {
      await navigator.clipboard.writeText(color)
      setCopiedColor(color)
      setTimeout(() => setCopiedColor(null), 2000)
    } catch {
      // Fallback: just show in UI
      setCopiedColor(color)
      setTimeout(() => setCopiedColor(null), 2000)
    }
  }

  const ColorSwatch = ({ color, label }: { color: string; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        className="color-swatch"
        style={{
          background: color,
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
        title={`Copy ${color}`}
        onClick={() => copyHex(color)}
        type="button"
        aria-label={`Copy ${label} color ${color}`}
      />
      <div>
        <div className="text-small text-muted" style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
          {label}
        </div>
        <div
          className="text-small font-semibold"
          style={{ fontFamily: 'monospace', letterSpacing: '0.03em', fontSize: '0.875rem' }}
        >
          {color}
        </div>
        {copiedColor === color && (
          <div className="text-small" style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '2px' }}>
            ✓ Copied
          </div>
        )}
      </div>
    </div>
  )

  const PaletteColorButton = ({ color, isSelected }: { color: string; isSelected?: boolean }) => (
    <button
      type="button"
      onClick={() => onColorSelect?.(color)}
      title={`Select as primary color: ${color}`}
      style={{
        width: '48px',
        height: '48px',
        borderRadius: 'var(--radius-md)',
        background: color,
        border: isSelected ? `3px solid var(--color-accent)` : '1px solid var(--color-border)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        padding: 0,
        minWidth: '48px',
      }}
      aria-label={`Select color ${color}`}
    />
  )

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div
          className="text-small text-muted"
          style={{
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.75rem',
          }}
        >
          Brand Preview
        </div>

        {/* Company header with logo and name */}
        <div
          className="flex items-center"
          style={{
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
            padding: '16px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Logo container */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {assets.logoUrl && !logoError ? (
              <img
                src={assets.logoUrl}
                alt={`${assets.companyName} logo`}
                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                onError={() => onLogoError?.(true)}
              />
            ) : (
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: displayPrimaryColor }}>
                {assets.companyName.charAt(0)}
              </span>
            )}
          </div>

          {/* Company info */}
          <div style={{ flex: 1 }}>
            <div className="text-h2">{assets.companyName}</div>
            <div className="text-small text-muted" style={{ marginTop: '4px' }}>
              {assets.domain}
            </div>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div style={{ marginBottom: '24px' }}>
        <div
          className="text-small font-semibold"
          style={{
            marginBottom: '16px',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.75rem',
          }}
        >
          Brand Colors
        </div>

        {/* Primary & Secondary swatches */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ padding: '16px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <ColorSwatch color={displayPrimaryColor} label="Primary" />
          </div>
          <div style={{ padding: '16px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <ColorSwatch color={displaySecondaryColor} label="Secondary" />
          </div>
        </div>

        {/* Color gradient preview */}
        <div
          style={{
            height: '12px',
            borderRadius: 'var(--radius-md)',
            background: `linear-gradient(to right, ${displayPrimaryColor} 0%, ${displaySecondaryColor} 100%)`,
            marginBottom: '20px',
            boxShadow: 'var(--shadow-card)',
          }}
        />

        {/* Full color palette from Brandfetch */}
        {assets.colors && assets.colors.length > 0 && (
          <div
            style={{
              padding: '16px',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="text-small text-muted"
              style={{
                marginBottom: '12px',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Full Color Palette ({assets.colors.length})
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {assets.colors.map((color) => (
                <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <PaletteColorButton color={color} isSelected={primaryColor === color} />
                  <span
                    className="text-small"
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => copyHex(color)}
                    title={`Copy ${color}`}
                  >
                    {color}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secondary color picker when fewer than 2 colors */}
        {assets.colors && assets.colors.length < 2 && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <label htmlFor={`secondary-color-picker-${assets.domain}`} style={{ display: 'block', marginBottom: '12px' }}>
              <div
                className="text-small text-muted"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}
              >
                Choose Secondary Color
              </div>
              <p className="text-small text-muted" style={{ fontSize: '0.75rem' }}>
                We found only {assets.colors.length} color{assets.colors.length !== 1 ? 's' : ''}. Select a secondary color to complete your palette.
              </p>
            </label>
            <input
              id={`secondary-color-picker-${assets.domain}`}
              type="color"
              value={displaySecondaryColor}
              onChange={(e) => onSecondaryColorChange?.(e.target.value)}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
              title="Select a secondary color"
            />
            {userSelectedSecondaryColor && (
              <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Selected: <code style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text)' }}>{userSelectedSecondaryColor}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Typography Section */}
      {assets.fonts && assets.fonts.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div
            className="text-small font-semibold"
            style={{
              marginBottom: '16px',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.75rem',
            }}
          >
            Brand Typography ({assets.fonts.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {assets.fonts.map((font) => (
              <div
                key={font}
                style={{
                  padding: '16px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="text-small font-semibold" style={{ marginBottom: '8px' }}>
                  {font}
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: '0.875rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
