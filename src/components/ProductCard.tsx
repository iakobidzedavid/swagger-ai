'use client'

import { useState } from 'react'

export interface ProductVariant {
  id: string
  title: string
  price: number
}

export interface Product {
  id: string
  title: string
  description: string
  category: string
  image: string
  mockupImage?: string
  variants: ProductVariant[]
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

interface ProductCardProps {
  product: Product
  isSelected?: boolean
  onToggle?: () => void
  onClick?: () => void
  variant?: 'selectable' | 'static'
}

/**
 * ProductCard — reusable product display component
 * Can be used in product selection flows, storefronts, and previews
 */
export function ProductCard({
  product,
  isSelected = false,
  onToggle,
  onClick,
  variant = 'selectable'
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false)

  const displayImage = product.mockupImage || product.image
  const price = product.variants[0]?.price || 0

  const cardStyle: React.CSSProperties = {
    cursor: variant === 'selectable' ? 'pointer' : 'pointer',
    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    transition: 'all 200ms ease',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  }

  const handleClick = () => {
    if (variant === 'selectable' && onToggle) {
      onToggle()
    }
    if (onClick) {
      onClick()
    }
  }

  return (
    <div
      className="card"
      style={cardStyle}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Product image container — premium styling */}
      <div
        style={{
          width: '100%',
          height: '200px',
          background: 'linear-gradient(135deg, var(--color-border) 0%, var(--color-surface) 100%)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'transform 200ms ease',
        }}
      >
        {!imageError ? (
          <img
            src={displayImage}
            alt={product.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 200ms ease',
            }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.875rem',
          }}>
            Image unavailable
          </div>
        )}
      </div>

      {/* Content area — flexes to fill */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Checkbox (if selectable) */}
        {variant === 'selectable' && (
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation()
                if (onToggle) onToggle()
              }}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: 'var(--color-accent)',
              }}
              aria-label={`Select ${product.title}`}
            />
            <span className="font-semibold" style={{ color: 'var(--color-text)', fontSize: '0.95rem' }}>{product.title}</span>
          </div>
        )}

        {/* Title (if static) */}
        {variant === 'static' && (
          <h3 className="font-semibold" style={{ marginBottom: '8px', color: 'var(--color-text)', fontSize: '1rem', lineHeight: '1.4' }}>
            {product.title}
          </h3>
        )}

        {/* Description */}
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          marginBottom: '12px',
          flex: 1,
        }}>
          {product.description}
        </p>

        {/* Category tag */}
        {product.category && (
          <div style={{ marginBottom: '12px' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-tint)',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {product.category}
            </span>
          </div>
        )}

        {/* Price — bottom aligned */}
        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{
            color: 'var(--color-accent)',
            fontSize: '1.25rem',
            fontWeight: '700',
          }}>
            ${price.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}
