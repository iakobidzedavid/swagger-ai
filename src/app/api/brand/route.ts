import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DOMAIN_RE, normalizeDomain, isCacheFresh } from '@/lib/brand'
import { fetchBrandData } from '@/lib/brandfetch'

// Brand extraction requires the Node.js runtime (zlib + Buffer for the
// keyless PNG-decode fallback in src/lib/keyless-brand.ts), not Edge.
export const runtime = 'nodejs'

/**
 * Brandfetch integration API route (DE-18 revenue engine).
 *
 * This is the canonical, reusable brand-lookup endpoint for the acquisition
 * funnel: the homepage domain-input widget (`HomepageBrandPreview`) calls it
 * for an instant, read-only preview before a visitor commits to the full
 * `/onboard` flow. It does NOT write the user-facing submission record —
 * that's still created by `/api/domain/submit` when the user continues on
 * `/onboard`. It DOES read/write a perf-only `brand_cache` table (see below)
 * so repeat lookups of the same domain skip redundant external fetches.
 *
 * Brand source, in priority order:
 *   1. `brand_cache` (Supabase) — a fresh (<24h) cached result for this exact
 *      domain, from ANY prior lookup by ANY visitor. Cuts external calls for
 *      popular/repeat domains. Never a hard dependency: any cache read/write
 *      failure falls through to fetching live, so Supabase being unreachable
 *      never breaks this endpoint.
 *   2. `fetchBrandData()` (src/lib/brandfetch.ts) — the single canonical
 *      brand-extraction entrypoint shared with `/api/domain/submit` and
 *      `/api/design-engine/mockup`: real Brandfetch API when
 *      BRANDFETCH_API_KEY is set, else the keyless fallback (favicon +
 *      dominant-color PNG decode + theme-color scrape).
 */

interface BrandCacheRow {
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  source: string
  raw_brand_data: Record<string, unknown> | null
  hit_count: number
  fetched_at: string
}

interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  colors?: string[]
  fonts?: string[]
  raw: Record<string, unknown>
}

function cacheRowToBrandData(row: BrandCacheRow): BrandData {
  const rawData = row.raw_brand_data ?? {}
  const colors = (rawData as any)?.colors ?? []
  const fonts = (rawData as any)?.fonts ?? []
  return {
    domain: row.domain,
    companyName: row.company_name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    colors: colors,    // Always include arrays, even if empty
    fonts: fonts,      // Always include arrays, even if empty
    // Additive-only annotation — neither existing caller (HomepageBrandPreview,
    // /onboard) reads `raw`, so merging `cached: true` in cannot break them.
    source: row.source as BrandData['source'],
    raw: { ...rawData, cached: true, hitCount: row.hit_count },
  }
}

/** Best-effort cache read. Returns null on any failure (missing table, RLS
 * denial, network blip) or on a stale/missing row — caller always falls
 * through to a live fetch in every one of those cases. */
async function readCache(domain: string): Promise<BrandCacheRow | null> {
  try {
    const { data, error } = await supabase
      .from('brand_cache')
      .select('*')
      .eq('domain', domain)
      .maybeSingle()
    if (error || !data) return null
    const row = data as BrandCacheRow
    if (!isCacheFresh(row.fetched_at, Date.now())) return null
    return row
  } catch (err) {
    console.warn('brand_cache read failed (continuing without cache):', err)
    return null
  }
}

/** Fire-and-forget hit-count bump on a cache hit — never awaited by the
 * request path so a cache hit stays fast even if this write is slow/fails.
 * Wrapped defensively: this must never throw into the request path even if
 * the Supabase client construction itself fails synchronously. */
function bumpHitCount(domain: string, currentHitCount: number) {
  try {
    Promise.resolve(
      supabase
        .from('brand_cache')
        .update({ hit_count: currentHitCount + 1 })
        .eq('domain', domain),
    )
      .then((result: { error: unknown }) => {
        if (result.error) console.warn('brand_cache hit_count bump failed:', result.error)
      })
      .catch((err: unknown) => console.warn('brand_cache hit_count bump threw:', err))
  } catch (err) {
    console.warn('brand_cache hit_count bump threw synchronously:', err)
  }
}

/** Best-effort cache write after a live fetch. Never throws — a cache write
 * failure must not turn a successful brand fetch into a 500. */
async function writeCache(brand: BrandData): Promise<void> {
  try {
    const { error } = await supabase
      .from('brand_cache')
      .upsert(
        {
          domain: brand.domain,
          company_name: brand.companyName,
          logo_url: brand.logoUrl,
          primary_color: brand.primaryColor,
          secondary_color: brand.secondaryColor,
          source: brand.source,
          brand_source: brand.source,
          color_count: brand.raw?.colorCount ?? 0,
          font_count: brand.raw?.fontCount ?? 0,
          raw_brand_data: brand.raw,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'domain' },
      )
    if (error) console.warn('brand_cache write failed (continuing, cache is perf-only):', error)
  } catch (err) {
    console.warn('brand_cache write threw (continuing, cache is perf-only):', err)
  }
}

export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domainParam) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  const domain = normalizeDomain(domainParam)
  // 253 is the real max length of a DNS name — rejects anything that can't
  // possibly be a domain before it ever reaches the cache table.
  if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: 'Enter a valid domain (e.g., acme.com)' }, { status: 400 })
  }

  const cached = await readCache(domain)
  if (cached) {
    bumpHitCount(domain, cached.hit_count)
    return NextResponse.json(cacheRowToBrandData(cached))
  }

  const brand = await fetchBrandData(domain)
  await writeCache(brand)

  return NextResponse.json(brand)
}
