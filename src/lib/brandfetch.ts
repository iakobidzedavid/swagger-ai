/**
 * Brandfetch API client — comprehensive brand data extraction
 *
 * Fetches logos, color palettes, fonts, typography, and official company metadata
 * from the Brandfetch API. When the API key is unavailable or the API fails, gracefully
 * falls back to keyless mode (Google favicon + HTML meta-tag extraction).
 *
 * The Brandfetch API v2 provides:
 *  - Logos (multiple sizes and formats)
 *  - Official brand colors (primary + palette)
 *  - Typography (fonts used in brand)
 *  - Company name, description, website
 *  - Brand guidelines metadata
 */

export interface BrandfetchLogoData {
  src?: string
  formats?: Array<{ src?: string; format?: string }>
  type?: string
}

export interface BrandfetchColorData {
  hex?: string
  type?: string
  brightness?: number
}

export interface BrandfetchFontData {
  name?: string
  weights?: string[]
  type?: string
}

export interface BrandfetchRawResponse {
  id?: string
  name?: string
  description?: string
  website?: string
  logos?: BrandfetchLogoData[]
  colors?: BrandfetchColorData[]
  fonts?: BrandfetchFontData[]
  dateModified?: string
}

export interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  colors?: string[] // Full palette from Brandfetch
  fonts?: string[] // Font families from Brandfetch
  raw: {
    brandfetchId?: string
    brandfetchModified?: string
    colorCount?: number
    fontCount?: number
    colorSource?: string
    logoSource?: string
    [key: string]: unknown
  }
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
])

/**
 * Fetch brand data from Brandfetch API v2.
 * Returns null when the API key is unset, the request fails, or parsing fails.
 * The caller always falls back to the keyless path in these cases.
 */
export async function fetchFromBrandfetch(domain: string): Promise<BrandData | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      console.warn(`Brandfetch request failed for ${domain}: ${response.status}`)
      return null
    }

    const data = await response.json() as BrandfetchRawResponse

    // Extract logos (prefer SVG, then PNG, then any available)
    const logoUrl = extractBestLogo(data.logos)

    // Extract colors with validation
    const colors = extractColors(data.colors)
    const primaryColor = colors[0] ?? '#7c3aed'
    const secondaryColor = colors[1] ?? lightenColor(primaryColor)

    // Extract fonts
    const fonts = extractFonts(data.fonts)

    const companyName = data.name ?? deriveCompanyName(domain)

    return {
      domain,
      companyName,
      logoUrl,
      primaryColor,
      secondaryColor,
      source: 'brandfetch',
      colors: colors.length > 0 ? colors : undefined,
      fonts: fonts.length > 0 ? fonts : undefined,
      raw: {
        brandfetchId: data.id,
        brandfetchModified: data.dateModified,
        colorCount: colors.length,
        fontCount: fonts.length,
        colorSource: 'brandfetch-api',
        logoSource: logoUrl ? 'brandfetch-api' : undefined,
        description: data.description,
      },
    }
  } catch (error) {
    console.warn('Brandfetch fetch error:', error)
    return null
  }
}

/**
 * Extract the best logo URL from Brandfetch logos array.
 * Preference order: SVG → PNG → any available.
 */
function extractBestLogo(logos: BrandfetchLogoData[] | undefined): string | null {
  if (!logos || logos.length === 0) return null

  // Try to find SVG first (vector, scales best)
  for (const logo of logos) {
    if (logo.type === 'symbol' || logo.formats?.some(f => f.format === 'svg')) {
      return logo.src ?? logo.formats?.find(f => f.format === 'svg')?.src ?? null
    }
  }

  // Try PNG
  for (const logo of logos) {
    if (logo.type === 'mark' || logo.formats?.some(f => f.format === 'png')) {
      return logo.src ?? logo.formats?.find(f => f.format === 'png')?.src ?? null
    }
  }

  // Fallback to any available
  return logos[0]?.src ?? null
}

/**
 * Extract and validate colors from Brandfetch color array.
 * Only includes valid hex colors; filters out invalid data.
 */
function extractColors(colors: BrandfetchColorData[] | undefined): string[] {
  if (!colors) return []

  const hexPattern = /^#[0-9a-f]{6}$/i
  const validated: string[] = []

  for (const color of colors) {
    if (color.hex && hexPattern.test(color.hex)) {
      validated.push(color.hex.toLowerCase())
    }
  }

  return validated
}

/**
 * Extract font names from Brandfetch fonts array.
 */
function extractFonts(fonts: BrandfetchFontData[] | undefined): string[] {
  if (!fonts) return []
  return fonts
    .filter(f => f.name)
    .map(f => f.name!)
    .slice(0, 5) // Limit to 5 fonts for practical use
}

/**
 * Lighten a hex color by mixing with white.
 * Used for deriving a secondary color from a primary.
 */
export function lightenColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const factor = 0.6
    const nr = Math.round(r + (255 - r) * factor)
    const ng = Math.round(g + (255 - g) * factor)
    const nb = Math.round(b + (255 - b) * factor)
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
  } catch {
    return '#8fa3b8' // Neutral slate fallback
  }
}

/**
 * Derive a company name from a domain.
 * Example: "linear.app" → "Linear"
 */
export function deriveCompanyName(domain: string): string {
  const host = domain.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Check if a domain is a personal email provider.
 */
export function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain)
}
