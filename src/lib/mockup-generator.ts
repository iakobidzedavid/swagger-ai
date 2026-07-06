/**
 * Mockup Generator — Creates SVG-based product mockups with brand colors and logos
 *
 * Generates realistic-looking product previews that incorporate:
 * - Brand primary and secondary colors
 * - Company logo overlay
 * - Product title and category labels
 * - Professional styling to appear hand-designed, not auto-generated
 */

interface MockupInput {
  productId: string
  productTitle: string
  productCategory: 'apparel' | 'drinkware' | 'accessories'
  logoUrl?: string | null
  primaryColor: string
  secondaryColor: string
  companyName: string
}

interface MockupOutput {
  svg: string
  dataUrl: string
  cacheKey: string
}

/**
 * Normalize hex color to #RRGGBB format
 */
function normalizeHexColor(color: string): string {
  color = color.trim()
  if (!color.startsWith('#')) {color = '#' + color}
  if (color.length === 4) {
    // #RGB -> #RRGGBB
    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }
  return color.length === 7 ? color : '#7c3aed'
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!result) {return { r: 124, g: 58, b: 237 }} // violet fallback
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Check if a color is light or dark (for determining text color)
 */
function isLightColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Get contrasting text color (white or dark gray) for a background color
 */
function getTextColorForBg(bgColor: string): string {
  return isLightColor(bgColor) ? '#1a1a1a' : '#ffffff'
}

/**
 * Escape a string for safe interpolation into SVG/XML attribute and text
 * content. Real logo URLs (Clearbit/Brandfetch) almost always contain an
 * unescaped `&` in the query string (e.g. `?size=128&format=png`); embedding
 * that directly into an `href="..."` produces invalid XML, which makes the
 * browser refuse to render the *entire* SVG — the classic "broken image
 * icon" bug. Product titles can also contain `&`, `<`, `>`, or `"`.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate a realistic-looking apparel product mockup (e.g., t-shirt, hoodie)
 */
function generateApparelMockup(input: MockupInput): string {
  const { productTitle, primaryColor, secondaryColor, logoUrl } = input
  const primary = normalizeHexColor(primaryColor)
  const secondary = normalizeHexColor(secondaryColor)
  const safeTitle = escapeXml(productTitle)
  const safeLogoUrl = logoUrl ? escapeXml(logoUrl) : logoUrl

  // Product silhouette shape (simplified apparel form)
  const width = 300
  const height = 360
  const garmentColor = primary

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background with gradient -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primary};stop-opacity:0.08" />
          <stop offset="100%" style="stop-color:${secondary};stop-opacity:0.08" />
        </linearGradient>
        <linearGradient id="garmentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondary};stop-opacity:0.8" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3" />
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)" />

      <!-- Garment (simplified t-shirt/hoodie shape) -->
      <g filter="url(#shadow)">
        <!-- Main body -->
        <path d="M 60 80 L 100 120 L 100 280 Q 100 300 120 300 L 180 300 Q 200 300 200 280 L 200 120 L 240 80 Z"
              fill="url(#garmentGradient)" stroke="${secondary}" stroke-width="1" />
        <!-- Sleeves -->
        <ellipse cx="40" cy="140" rx="20" ry="35" fill="url(#garmentGradient)" opacity="0.9" />
        <ellipse cx="260" cy="140" rx="20" ry="35" fill="url(#garmentGradient)" opacity="0.9" />
      </g>

      <!-- Logo placeholder (center of garment) -->
      ${safeLogoUrl ? `
        <g id="logoGroup">
          <!-- Subtle background for logo -->
          <circle cx="150" cy="170" r="35" fill="#ffffff" opacity="0.15" />
          <image x="125" y="145" width="50" height="50" href="${safeLogoUrl}"
                 preserveAspectRatio="xMidYMid slice" opacity="0.95" />
        </g>
      ` : `
        <!-- Logo placeholder circle -->
        <circle cx="150" cy="170" r="30" fill="#ffffff" opacity="0.2" stroke="#ffffff" stroke-width="2" stroke-opacity="0.3" />
        <text x="150" y="175" text-anchor="middle" font-size="18" font-weight="bold"
              fill="#ffffff" opacity="0.4" font-family="system-ui, -apple-system, sans-serif">LOGO</text>
      `}

      <!-- Product title at bottom -->
      <text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-size="16"
            font-weight="600" fill="${getTextColorForBg(primary)}"
            font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>

      <!-- Subtle shine/highlight effect -->
      <ellipse cx="120" cy="130" rx="30" ry="60" fill="#ffffff" opacity="0.15" />
    </svg>
  `
}

/**
 * Generate a realistic-looking drinkware product mockup (e.g., mug, bottle)
 */
function generateDrinkwareMockup(input: MockupInput): string {
  const { productTitle, primaryColor, secondaryColor, logoUrl } = input
  const primary = normalizeHexColor(primaryColor)
  const secondary = normalizeHexColor(secondaryColor)
  const safeTitle = escapeXml(productTitle)
  const safeLogoUrl = logoUrl ? escapeXml(logoUrl) : logoUrl

  const width = 300
  const height = 360

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Defs -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${secondary};stop-opacity:0.08" />
          <stop offset="100%" style="stop-color:${primary};stop-opacity:0.08" />
        </linearGradient>
        <linearGradient id="containerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondary};stop-opacity:0.85" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.25" />
        </filter>
        <filter id="highlight">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)" />

      <!-- Container (mug/bottle) with perspective -->
      <g filter="url(#shadow)">
        <!-- Base -->
        <ellipse cx="150" cy="280" rx="50" ry="15" fill="${secondary}" opacity="0.6" />
        <!-- Main body -->
        <path d="M 100 100 Q 90 180 95 260 L 205 260 Q 210 180 200 100 Z"
              fill="url(#containerGradient)" stroke="${secondary}" stroke-width="1" />
        <!-- Top rim -->
        <ellipse cx="150" cy="100" rx="50" ry="18" fill="${secondary}" opacity="0.4" />
      </g>

      <!-- Handle -->
      <g>
        <path d="M 200 140 Q 230 160 230 200 Q 230 240 200 240"
              stroke="${primary}" stroke-width="12" fill="none"
              stroke-linecap="round" opacity="0.7" />
      </g>

      <!-- Logo in center of container -->
      ${safeLogoUrl ? `
        <g id="logoGroup" opacity="0.9">
          <!-- Subtle background -->
          <rect x="115" y="150" width="70" height="70" rx="5" fill="#ffffff" opacity="0.12" />
          <image x="120" y="155" width="60" height="60" href="${safeLogoUrl}"
                 preserveAspectRatio="xMidYMid slice" />
        </g>
      ` : `
        <!-- Logo placeholder -->
        <rect x="115" y="150" width="70" height="70" rx="5" fill="#ffffff" opacity="0.15"
              stroke="#ffffff" stroke-width="1" stroke-opacity="0.2" />
        <text x="150" y="195" text-anchor="middle" font-size="14" font-weight="bold"
              fill="#ffffff" opacity="0.35" font-family="system-ui, -apple-system, sans-serif">LOGO</text>
      `}

      <!-- Shine/highlight at top -->
      <ellipse cx="130" cy="115" rx="15" ry="12" fill="#ffffff" opacity="0.25" filter="url(#highlight)" />

      <!-- Product title -->
      <text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-size="16"
            font-weight="600" fill="${getTextColorForBg(primary)}"
            font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    </svg>
  `
}

/**
 * Generate a realistic-looking accessories product mockup (e.g., tote bag, beanie)
 */
function generateAccessoriesMockup(input: MockupInput): string {
  const { productTitle, primaryColor, secondaryColor, logoUrl } = input
  const primary = normalizeHexColor(primaryColor)
  const secondary = normalizeHexColor(secondaryColor)
  const safeTitle = escapeXml(productTitle)
  const safeLogoUrl = logoUrl ? escapeXml(logoUrl) : logoUrl

  const width = 300
  const height = 360

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primary};stop-opacity:0.08" />
          <stop offset="100%" style="stop-color:${secondary};stop-opacity:0.08" />
        </linearGradient>
        <linearGradient id="itemGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${secondary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${primary};stop-opacity:0.8" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3" />
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)" />

      <!-- Tote bag shape -->
      <g filter="url(#shadow)">
        <!-- Bag body -->
        <path d="M 70 120 L 65 280 Q 65 300 85 300 L 215 300 Q 235 300 235 280 L 230 120 Z"
              fill="url(#itemGradient)" stroke="${primary}" stroke-width="1.5" />
        <!-- Handles -->
        <path d="M 90 120 Q 90 60 150 50 Q 210 60 210 120"
              stroke="${primary}" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.8" />
      </g>

      <!-- Logo area (front of bag) -->
      ${safeLogoUrl ? `
        <g id="logoGroup" opacity="0.92">
          <!-- Background panel for logo -->
          <rect x="110" y="160" width="80" height="80" rx="3" fill="#ffffff" opacity="0.16" />
          <image x="115" y="165" width="70" height="70" href="${safeLogoUrl}"
                 preserveAspectRatio="xMidYMid slice" />
        </g>
      ` : `
        <!-- Logo placeholder -->
        <rect x="110" y="160" width="80" height="80" rx="3" fill="#ffffff" opacity="0.15"
              stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.25" />
        <text x="150" y="210" text-anchor="middle" font-size="16" font-weight="bold"
              fill="#ffffff" opacity="0.32" font-family="system-ui, -apple-system, sans-serif">LOGO</text>
      `}

      <!-- Texture lines for realism -->
      <line x1="75" y1="130" x2="225" y2="135" stroke="#ffffff" stroke-width="1" opacity="0.08" />
      <line x1="70" y1="200" x2="230" y2="205" stroke="#ffffff" stroke-width="1" opacity="0.06" />

      <!-- Product title -->
      <text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-size="16"
            font-weight="600" fill="${getTextColorForBg(secondary)}"
            font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    </svg>
  `
}

/**
 * Generate a branded product mockup SVG based on category
 */
function generateMockupSvg(input: MockupInput): string {
  switch (input.productCategory) {
    case 'apparel':
      return generateApparelMockup(input)
    case 'drinkware':
      return generateDrinkwareMockup(input)
    case 'accessories':
      return generateAccessoriesMockup(input)
    default:
      return generateApparelMockup(input)
  }
}

/**
 * Create a cache key for a product mockup
 */
export function createMockupCacheKey(
  productId: string,
  domain: string,
  primaryColor: string,
  secondaryColor: string
): string {
  const normalized = `${productId}|${domain}|${normalizeHexColor(primaryColor)}|${normalizeHexColor(secondaryColor)}`
  // Simple hash
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `mockup_${Math.abs(hash).toString(16)}`
}

/**
 * Generate a branded product mockup with SVG and data URL
 */
export function generateMockup(input: MockupInput): MockupOutput {
  const svg = generateMockupSvg(input)

  // Create data URL from SVG
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

  const cacheKey = createMockupCacheKey(
    input.productId,
    input.companyName,
    input.primaryColor,
    input.secondaryColor
  )

  return {
    svg,
    dataUrl,
    cacheKey,
  }
}
