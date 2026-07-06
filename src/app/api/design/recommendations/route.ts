import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { DOMAIN_RE, normalizeDomain, isCacheFresh } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface DesignRecommendation {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  /**
   * Full color palette from Brandfetch (if available).
   * Includes all detected brand colors, not just primary/secondary.
   */
  colorPalette: string[]
  /**
   * Suggested accent colors derived from palette (not primary/secondary).
   * Useful for CTAs, hover states, focus states in the storefront.
   */
  accentColors: string[]
  /**
   * Font family suggestions from Brandfetch.
   */
  fonts: string[]
  /**
   * Design guidelines text (e.g., "Use primary color for CTAs").
   */
  guidelines: string[]
}

/**
 * Extract accent colors from a palette — return colors that are NOT
 * the primary or secondary to offer visual variety in UI.
 */
function extractAccentColors(
  palette: string[],
  primaryColor: string,
  secondaryColor: string,
): string[] {
  const accents: string[] = []
  const excluded = new Set([
    primaryColor.toLowerCase(),
    secondaryColor.toLowerCase(),
  ])

  for (const color of palette) {
    if (!excluded.has(color.toLowerCase())) {
      accents.push(color)
      if (accents.length >= 3) {break} // Limit to 3 accent colors
    }
  }

  return accents
}

/**
 * Generate design guidelines based on brand source and palette quality.
 */
function generateGuidelines(
  source: string,
  hasMultipleColors: boolean,
  hasFonts: boolean,
  hasLogo: boolean,
): string[] {
  const guidelines: string[] = []

  if (source === 'brandfetch') {
    guidelines.push('✓ Full brand palette detected from Brandfetch')
    if (hasMultipleColors) {
      guidelines.push('✓ Multiple brand colors available for flexible design')
    }
    if (hasFonts) {
      guidelines.push('✓ Typography recommendations available')
    }
    if (hasLogo) {
      guidelines.push('✓ Company logo detected — use prominently in header')
    }
    guidelines.push('→ Use primary color for main CTAs (Add to Cart)')
    guidelines.push('→ Use secondary color for hover/active states')
    if (guidelines.length > 4) {
      guidelines.push('→ Use accent colors for emphasis and visual hierarchy')
    }
  } else if (source === 'favicon') {
    guidelines.push('⚠ Logo-derived color palette (limited metadata)')
    guidelines.push('→ Color extracted from company favicon')
    guidelines.push('→ Verify color matches brand guidelines')
  } else if (source === 'theme-color') {
    guidelines.push('⚠ Theme color meta tag only — limited palette')
    guidelines.push('→ Verify color matches company brand standard')
  } else {
    guidelines.push('ℹ Using default neutral color')
    guidelines.push('→ Visit company website to confirm colors')
  }

  return guidelines
}

/**
 * Fetch design recommendations for a domain.
 * Looks up the domain in Supabase (brand_cache or domain_submissions table)
 * and returns enriched design data with full palettes, fonts, and guidelines.
 *
 * Uses the same cache-staleness logic as /api/brand: fallback sources
 * (favicon, theme-color) are always treated as stale to prioritize refetching
 * from Brandfetch when the API recovers, avoiding serving poisoned cache forever.
 */
async function fetchRecommendations(domain: string): Promise<DesignRecommendation | null> {
  // Try to fetch from brand_cache first (faster, cached).
  // But skip it if: (1) it's stale by TTL, or (2) the source is a fallback
  // (favicon/theme-color), indicating Brandfetch failed at cache time.
  const { data: cached } = await supabase
    .from('brand_cache')
    .select('*')
    .eq('domain', domain)
    .maybeSingle()

  const cacheIsUsable =
    cached &&
    isCacheFresh(cached.fetched_at, Date.now(), cached.source)

  if (cacheIsUsable && cached) {
    const raw = (cached.raw_brand_data as Record<string, unknown>) || {}
    const colorPalette = (raw.colors as string[]) || [
      cached.primary_color,
      cached.secondary_color,
    ]
    const fonts = (raw.fonts as string[]) || []
    const accentColors = extractAccentColors(
      colorPalette,
      cached.primary_color,
      cached.secondary_color,
    )
    const guidelines = generateGuidelines(
      cached.source || 'fallback',
      colorPalette.length > 2,
      fonts.length > 0,
      Boolean(cached.logo_url),
    )

    return {
      domain: cached.domain,
      companyName: cached.company_name,
      logoUrl: cached.logo_url,
      primaryColor: cached.primary_color,
      secondaryColor: cached.secondary_color,
      source: (cached.source || 'fallback') as DesignRecommendation['source'],
      colorPalette,
      accentColors,
      fonts,
      guidelines,
    }
  }

  // Fallback to domain_submissions table
  const { data: submission } = await supabase
    .from('domain_submissions')
    .select('*')
    .eq('domain', domain)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (submission) {
    const raw = (submission.raw_brand_data as Record<string, unknown>) || {}
    const colorPalette = (raw.colors as string[]) || [
      submission.primary_color,
      submission.secondary_color,
    ]
    const fonts = (raw.fonts as string[]) || []
    const accentColors = extractAccentColors(
      colorPalette,
      submission.primary_color,
      submission.secondary_color,
    )
    const guidelines = generateGuidelines(
      submission.brand_source || 'fallback',
      colorPalette.length > 2,
      fonts.length > 0,
      Boolean(submission.logo_url),
    )

    return {
      domain: submission.domain,
      companyName: submission.company_name,
      logoUrl: submission.logo_url,
      primaryColor: submission.primary_color,
      secondaryColor: submission.secondary_color,
      source: (submission.brand_source || 'fallback') as DesignRecommendation['source'],
      colorPalette,
      accentColors,
      fonts,
      guidelines,
    }
  }

  return null
}

export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domainParam) {
    return NextResponse.json(
      { error: 'domain param required' },
      { status: 400 },
    )
  }

  const domain = normalizeDomain(domainParam)
  if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return NextResponse.json(
      { error: 'Enter a valid domain (e.g., acme.com)' },
      { status: 400 },
    )
  }

  const recommendations = await fetchRecommendations(domain)
  if (!recommendations) {
    return NextResponse.json(
      { error: 'No brand data found for this domain' },
      { status: 404 },
    )
  }

  return NextResponse.json(recommendations)
}
