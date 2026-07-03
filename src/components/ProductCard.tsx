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
    cursor: variant === 'selectable' ? 'pointer' : 'default',
    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: isSelected ? 'var(--color-surface)' : 'var(--color-bg)',
    transition: 'all 200ms ease',
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
    >
      {/* Product image */}
      <div
        style={{
          width: '100%',
          height: '160px',
          background: '#1a3a5c',
          borderRadius: '8px',
          marginBottom: '12px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!imageError ? (
          <img
            src={displayImage}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <img
            src={product.image}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Checkbox (if selectable) */}
      {variant === 'selectable' && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              if (onToggle) onToggle()
            }}
            style={{ marginRight: '8px' }}
            aria-label={`Select ${product.title}`}
          />
          <span className="text-small font-semibold">{product.title}</span>
        </div>
      )}

      {/* Title (if static) */}
      {variant === 'static' && (
        <div className="text-small font-semibold" style={{ marginBottom: '12px' }}>
          {product.title}
        </div>
      )}

      {/* Price */}
      <div className="text-small text-muted" style={{ marginBottom: '8px' }}>
        ${price.toFixed(2)}
      </div>

      {/* Description */}
      <div className="text-small text-muted">{product.description}</div>

      {/* Category tag */}
      {product.category && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
          <span className="text-small" style={{
            display: 'inline-block',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem'
          }}>
            {product.category}
          </span>
        </div>
      )}
    </div>
  )
}
