'use client'

import { useEffect, useState } from 'react'

export type OverlayCategory = 'apparel' | 'drinkware' | 'accessories' | string

interface ProductPhotoOverlayProps {
  /** The REAL product photo (Printify catalog photography) — never a generated mockup. */
  imageUrl: string
  /** Brand logo to overlay on the real photo. Omit/null renders the bare photo. */
  logoUrl?: string | null
  category?: OverlayCategory
  alt: string
  imageStyle?: React.CSSProperties
}

// Where the logo lands on a REAL Printify catalog photo, as a % of the photo's
// own box — tuned per category so it reads as "printed on the product", not a
// sticker slapped over the frame:
//  - apparel: center-chest on a front-facing tee/hoodie/polo/cap flat-lay shot
//  - drinkware: front label area on a mug/bottle
//  - accessories: front panel of a tote/drawstring bag/beanie
// `backing` mirrors the shape used server-side in mockup-generator.ts (circle
// for apparel, rounded rect for drinkware/accessories) so the two rendering
// paths feel like one design language.
const OVERLAY_POSITION: Record<
  string,
  { top: string; left: string; widthPct: number; backing: 'circle' | 'rect' }
> = {
  apparel: { top: '40%', left: '50%', widthPct: 20, backing: 'circle' },
  drinkware: { top: '46%', left: '50%', widthPct: 20, backing: 'rect' },
  accessories: { top: '45%', left: '50%', widthPct: 20, backing: 'rect' },
}

/**
 * ProductPhotoOverlay — renders the REAL product photo untouched, with the
 * brand logo composited on top via absolutely-positioned CSS (never baked
 * into the image itself, never a generated/replacement image).
 *
 * - logo is ~20% of the photo's width, centered on the garment's chest for
 *   apparel (or the equivalent front-panel for other categories)
 * - a soft translucent backing plate + drop-shadow keep the logo legible on
 *   both light and dark real photos without looking like a flat sticker
 */
export function ProductPhotoOverlay({
  imageUrl,
  logoUrl,
  category,
  alt,
  imageStyle,
}: ProductPhotoOverlayProps) {
  const [photoError, setPhotoError] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Reset error state when the underlying URLs change (e.g. selecting a
  // different product/domain re-uses this component instance via key reuse).
  useEffect(() => setPhotoError(false), [imageUrl])
  useEffect(() => setLogoError(false), [logoUrl])

  const pos = OVERLAY_POSITION[category || ''] || OVERLAY_POSITION.apparel
  const showLogo = !!logoUrl && !logoError && !photoError

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {!photoError ? (
        <img
          src={imageUrl}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imageStyle }}
          onError={() => setPhotoError(true)}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.875rem',
          }}
        >
          Image unavailable
        </div>
      )}

      {showLogo && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width: `${pos.widthPct}%`,
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: pos.backing === 'circle' ? '50%' : '18%',
            background: 'rgba(255, 255, 255, 0.16)',
            backdropFilter: 'blur(0.5px)',
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
          }}
        >
          <img
            src={logoUrl!}
            alt=""
            onError={() => setLogoError(true)}
            style={{
              width: '78%',
              height: '78%',
              objectFit: 'contain',
              filter:
                'drop-shadow(0 1px 3px rgba(0,0,0,0.4)) drop-shadow(0 0 1px rgba(0,0,0,0.25))',
              opacity: 0.94,
            }}
          />
        </div>
      )}
    </div>
  )
}
