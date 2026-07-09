/**
 * Brandfetch API client — comprehensive brand data extraction
 *
 * Fetches logos, color palettes, fonts, typography, and official company metadata
 * from the Brandfetch API. When the API key is unavailable or the API fails, gracefully
 * falls back to keyless mode (icon.horse favicon + HTML meta-tag extraction).
 *
 * The Brandfetch API v2 provides:
 *  - Logos (multiple sizes and formats)
 *  - Official brand colors (primary + palette)
 *  - Typography (fonts used in brand)
 *  - Company name, description, website
 *  - Brand guidelines metadata
 *
 * `fetchBrandData()` below is the SINGLE canonical entrypoint for brand
 * extraction anywhere in the app: Brandfetch first, keyless fallback second.
 * Every route that needs brand data (`/api/brand`, `/api/domain/submit`,
 * `/api/design-engine/mockup`) calls this one function so behavior never
 * drifts between them again.
 */
import { fetchKeylessBrand } from './keyless-brand'

interface BrandfetchLogoData {
  src?: string
  theme?: string
  type?: string
  formats?: Array<{ src?: string; format?: string; background?: string }>
}

interface BrandfetchColorData {
  hex?: string
  type?: string
  brightness?: number
}

interface BrandfetchFontData {
  name?: string
  weights?: string[]
  type?: string
}

interface BrandfetchRawResponse {
  id?: string
  name?: string
  description?: string
  website?: string
  logos?: BrandfetchLogoData[]
  colors?: BrandfetchColorData[]
  fonts?: BrandfetchFontData[]
  dateModified?: string
}

interface BrandData {
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
async function fetchFromBrandfetch(domain: string): Promise<BrandData | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) {
    console.warn(`[Brandfetch] API key not set for domain: ${domain}`)
    return null
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    console.log(`[Brandfetch] Fetching brand data for ${domain}...`)
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
      const errorText = await response.text()
      console.warn(`Brandfetch request failed for ${domain}: ${response.status} - ${errorText.slice(0, 200)}`)

      // Log quota errors separately for visibility
      if (response.status === 429) {
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.message?.includes('quota')) {
            console.error(`[Brandfetch Quota] ${errorData.message} (quota: ${errorData.quota}, used: ${errorData.used})`)
          }
        } catch {}
      }

      return null
    }

    const data = await response.json() as BrandfetchRawResponse
    console.log(`[Brandfetch] Successfully fetched data for ${domain}: ${data.name ?? 'unknown'}`)

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
      colors: colors, // Always include, even if empty (design-engine relies on this)
      fonts: fonts,   // Always include, even if empty (design-engine relies on this)
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
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.warn(`Brandfetch fetch error for ${domain}:`, errorMsg)
    return null
  }
}

/**
 * Extract the best logo URL from Brandfetch logos array.
 * Preference order: SVG (light theme) → SVG (any) → PNG (light) → PNG (any) → any available.
 *
 * Brandfetch v2 API returns logos with:
 * - `theme` field: 'light', 'dark', or other variants
 * - `type` field: 'logo', 'symbol', 'icon', etc.
 * - `formats` array: objects with `src`, `format` ('svg'|'png'|'webp'|'jpeg'), `background`
 * Note: logos don't have a direct `src` at the top level; src is nested in formats.
 */
function extractBestLogo(logos: BrandfetchLogoData[] | undefined): string | null {
  if (!logos || logos.length === 0) {return null}

  // Helper to find and extract format src by priority
  const findFormatUrl = (logo: BrandfetchLogoData, ...formats: string[]): string | null => {
    for (const fmt of formats) {
      const match = logo.formats?.find(f => f.format?.toLowerCase() === fmt.toLowerCase())
      if (match?.src) {return match.src}
    }
    return null
  }

  // Priority 1: Light-theme logo with SVG (preferred for design engines)
  for (const logo of logos) {
    if (logo.theme?.toLowerCase() === 'light') {
      const url = findFormatUrl(logo, 'svg', 'png', 'webp')
      if (url) {return url}
    }
  }

  // Priority 2: Any light-theme logo (any format)
  for (const logo of logos) {
    if (logo.theme?.toLowerCase() === 'light') {
      const url = findFormatUrl(logo, 'jpeg', 'webp', 'png')
      if (url) {return url}
    }
  }

  // Priority 3: SVG from any logo (no theme preference)
  for (const logo of logos) {
    const url = findFormatUrl(logo, 'svg')
    if (url) {return url}
  }

  // Priority 4: PNG from any logo
  for (const logo of logos) {
    const url = findFormatUrl(logo, 'png')
    if (url) {return url}
  }

  // Priority 5: Any available format from first logo
  if (logos[0]?.formats && logos[0].formats.length > 0) {
    return logos[0].formats[0]?.src ?? null
  }

  return null
}

/**
 * Extract and validate colors from Brandfetch color array.
 * Prioritizes by type (accent first, then primary colors, then supporting colors).
 * Only includes valid hex colors; filters out invalid data.
 *
 * Brandfetch v2 returns colors with:
 * - `hex`: the color value (may be 3, 4, 6, or 8 digit hex)
 * - `type`: 'accent', 'primary', 'dark', 'light', etc.
 * - `brightness`: luminance value 0-255
 */
function extractColors(colors: BrandfetchColorData[] | undefined): string[] {
  if (!colors) {return []}

  // Accept 3-digit (#FFF), 4-digit (#FFFA), 6-digit (#FFFFFF), or 8-digit (#FFFFFFFF) hex
  const hexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  const validated: Array<{ hex: string; type?: string; brightness?: number }> = []

  for (const color of colors) {
    if (color.hex && hexPattern.test(color.hex)) {
      // Normalize to 6-digit hex (expand 3/4-digit and drop alpha from 8-digit)
      let normalized = color.hex.toLowerCase()
      if (normalized.length === 4) {
        // #RGB → #RRGGBB
        normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3]
      } else if (normalized.length === 5) {
        // #RGBA → #RRGGBBAA → #RRGGBB (expand and drop alpha)
        normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3]
      } else if (normalized.length === 9) {
        // #RRGGBBAA → #RRGGBB (drop alpha)
        normalized = normalized.slice(0, 7)
      }
      validated.push({ hex: normalized, type: color.type, brightness: color.brightness })
    }
  }

  // Sort by type priority: accent > primary > others
  // Within each group, sort by saturation/brightness for better visual hierarchy
  validated.sort((a, b) => {
    const typeOrder = { accent: 0, primary: 1, secondary: 2, dark: 3, light: 4 }
    const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 99
    const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 99
    if (aOrder !== bOrder) {return aOrder - bOrder}
    // Secondary sort: prefer mid-range brightness (not too light, not too dark)
    const aBrightness = a.brightness ?? 128
    const bBrightness = b.brightness ?? 128
    const aDistance = Math.abs(aBrightness - 128)
    const bDistance = Math.abs(bBrightness - 128)
    return aDistance - bDistance
  })

  return validated.map(c => c.hex)
}

/**
 * Extract font names from Brandfetch fonts array.
 * Prioritizes by type (heading/title first, then body, then supporting fonts).
 * Deduplicates font names and limits to 5 unique fonts for practical use.
 *
 * Brandfetch v2 returns fonts with:
 * - `name`: the font family name (e.g., 'Inter', 'Sohne Var', 'system-ui')
 * - `type`: 'title', 'body', 'heading', etc.
 * - `weights`: array of available weights (optional)
 */
function extractFonts(fonts: BrandfetchFontData[] | undefined): string[] {
  if (!fonts) {return []}

  // Sort by type priority: title/heading first, then body, then others
  const typeOrder = { title: 0, heading: 1, body: 2 }
  const sorted = [...fonts].sort((a, b) => {
    const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 99
    const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 99
    return aOrder - bOrder
  })

  // Extract unique font names, preserving order
  const seen = new Set<string>()
  const extracted: string[] = []
  for (const font of sorted) {
    if (font.name && !seen.has(font.name)) {
      seen.add(font.name)
      extracted.push(font.name)
      if (extracted.length >= 5) {break} // Limit to 5 fonts
    }
  }

  return extracted
}

/**
 * Lighten a hex color by mixing with white.
 * Used for deriving a secondary color from a primary.
 */
function lightenColor(hex: string): string {
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
function deriveCompanyName(domain: string): string {
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

/**
 * Canonical brand-extraction entrypoint: Brandfetch API first (when
 * BRANDFETCH_API_KEY is set and the domain is found), keyless fallback
 * (favicon + PNG dominant color + theme-color scrape) otherwise. Never
 * throws and never returns null — the keyless path always resolves to at
 * least a neutral-slate fallback, so callers can rely on getting a BrandData
 * back unconditionally.
 */
export async function fetchBrandData(domain: string): Promise<BrandData> {
  const brandfetchResult = await fetchFromBrandfetch(domain)
  if (brandfetchResult) {return brandfetchResult}

  const keyless = await fetchKeylessBrand(domain)
  return {
    domain: keyless.domain,
    companyName: keyless.companyName,
    logoUrl: keyless.logoUrl,
    primaryColor: keyless.primaryColor,
    secondaryColor: keyless.secondaryColor,
    source: keyless.source,
    colors: [], // Keyless mode has no palette data, but include empty array for consistency
    fonts: [],  // Keyless mode has no font data, but include empty array for consistency
    raw: {
      logoSource: 'favicon',
      colorSource: keyless.colorSource,
    },
  }
}
