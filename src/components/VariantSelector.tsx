'use client'

export interface ProductVariant {
  id: string
  title: string
  price: number
}

interface VariantSelectorProps {
  variants: ProductVariant[]
  selectedVariantId: string
  onSelectVariant: (variantId: string) => void
  label?: string
  disabled?: boolean
}

/**
 * VariantSelector — intelligent component that detects variant type and renders appropriately
 * - Size variants: button group (XS, S, M, L, XL, etc.)
 * - Color variants: color swatches with hex values
 * - Other variants: dropdown fallback
 */
export function VariantSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  label = 'Size / Option',
  disabled = false,
}: VariantSelectorProps) {

  if (!variants || variants.length === 0) {
    return null
  }

  // Detect variant type from titles
  const detectVariantType = (): 'size' | 'color' | 'other' => {
    const titles = variants.map(v => v.title.toLowerCase())

    // Check for size indicators
    const sizePatterns = /^(xs|s|m|l|xl|xxl|2xl|3xl|\d+)/i
    if (titles.some(t => sizePatterns.test(t))) {
      return 'size'
    }

    // Check for color indicators (hex codes or color names)
    const colorPatterns = /#[0-9a-f]{6}|#[0-9a-f]{3}|(red|blue|green|black|white|yellow|orange|purple|pink|gray|grey|brown|navy|teal|cyan|magenta|coral|lime|indigo|gold|silver|bronze)/i
    if (titles.some(t => colorPatterns.test(t))) {
      return 'color'
    }

    return 'other'
  }

  const variantType = detectVariantType()
  const selectedVariant = variants.find(v => v.id === selectedVariantId)

  // Render size variants as button group
  if (variantType === 'size') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <label
          className="text-small font-semibold"
          style={{
            display: 'block',
            marginBottom: '12px',
            color: 'var(--color-text)',
          }}
        >
          {label}
        </label>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {variants.map(variant => (
            <button
              key={variant.id}
              onClick={() => onSelectVariant(variant.id)}
              disabled={disabled}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: selectedVariantId === variant.id
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                background: selectedVariantId === variant.id
                  ? 'var(--color-accent-subtle)'
                  : 'var(--color-surface)',
                color: selectedVariantId === variant.id
                  ? 'var(--color-accent)'
                  : 'var(--color-text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                opacity: disabled ? 0.6 : 1,
              }}
              onMouseEnter={e => {
                if (!disabled && selectedVariantId !== variant.id) {
                  const btn = e.currentTarget as HTMLElement
                  btn.style.borderColor = 'var(--color-accent)'
                  btn.style.background = 'var(--color-accent-subtle)'
                }
              }}
              onMouseLeave={e => {
                if (!disabled && selectedVariantId !== variant.id) {
                  const btn = e.currentTarget as HTMLElement
                  btn.style.borderColor = 'var(--color-border)'
                  btn.style.background = 'var(--color-surface)'
                }
              }}
              aria-pressed={selectedVariantId === variant.id}
              aria-label={`Select ${variant.title}`}
            >
              {variant.title}
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>
                ${(variant.price / 100).toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Render color variants as swatches
  if (variantType === 'color') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <label
          className="text-small font-semibold"
          style={{
            display: 'block',
            marginBottom: '12px',
            color: 'var(--color-text)',
          }}
        >
          {label}
        </label>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {variants.map(variant => {
            // Try to extract hex color from title
            const hexMatch = variant.title.match(/#[0-9a-f]{6}|#[0-9a-f]{3}/i)
            const hexColor = hexMatch ? hexMatch[0] : 'var(--color-surface)'
            const displayName = variant.title.replace(/#[0-9a-f]{3,6}/i, '').trim() || variant.title

            return (
              <div key={variant.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  onClick={() => onSelectVariant(variant.id)}
                  disabled={disabled}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    border: selectedVariantId === variant.id
                      ? '3px solid var(--color-accent)'
                      : '2px solid var(--color-border)',
                    background: hexColor,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: disabled ? 0.6 : 1,
                    padding: 0,
                    boxShadow: selectedVariantId === variant.id
                      ? '0 0 0 3px var(--color-accent-light)'
                      : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!disabled && selectedVariantId !== variant.id) {
                      const btn = e.currentTarget as HTMLElement
                      btn.style.borderColor = 'var(--color-accent)'
                      btn.style.boxShadow = '0 0 0 2px var(--color-accent-light)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!disabled && selectedVariantId !== variant.id) {
                      const btn = e.currentTarget as HTMLElement
                      btn.style.borderColor = 'var(--color-border)'
                      btn.style.boxShadow = 'none'
                    }
                  }}
                  aria-pressed={selectedVariantId === variant.id}
                  aria-label={`Select ${variant.title}`}
                />
                <div
                  style={{
                    marginTop: '8px',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    maxWidth: '56px',
                  }}
                >
                  <div style={{ fontWeight: 500, color: 'var(--color-text)', marginBottom: '2px' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '0.7rem' }}>
                    ${(variant.price / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Fallback: dropdown for other variant types
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor="variant-dropdown"
        className="text-small font-semibold"
        style={{
          display: 'block',
          marginBottom: '8px',
          color: 'var(--color-text)',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          id="variant-dropdown"
          value={selectedVariantId}
          onChange={e => onSelectVariant(e.target.value)}
          disabled={disabled}
          className="input-field"
          style={{ marginBottom: 0, appearance: 'none', paddingRight: '40px' }}
        >
          <option value="">Select an option</option>
          {variants.map(variant => (
            <option key={variant.id} value={variant.id}>
              {variant.title} — ${(variant.price / 100).toFixed(2)}
            </option>
          ))}
        </select>
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--color-text-muted)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
