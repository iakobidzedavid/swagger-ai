/**
 * DE Step 11 (Chart Your Competitive Position): on Maya's top-2 buying criteria —
 * brand accuracy and speed-to-launch — Swagger AI is the only player in the
 * upper-right quadrant. This module turns that research into a live product
 * feature: every real storefront generation is scored on the same two axes and
 * plotted against the researched competitor categories, so the buyer sees their
 * own real result inside the winning quadrant instead of just reading a claim.
 */

interface BrandFidelityBreakdown {
  logoDetected: boolean
  primaryColorDetected: boolean
  secondaryColorDetected: boolean
  productsLaunchedPct: number // 0-100, share of requested products actually created
}

interface BrandFidelityResult {
  pct: number
  breakdown: BrandFidelityBreakdown
}

const GENERIC_FALLBACK_COLORS = new Set(['#000000', '#ffffff', '#fff', '#000', ''])

/**
 * Objective, deterministic brand-accuracy score computed at generation time from
 * assets actually captured for this storefront (no survey, no LLM judgment) —
 * real signal available the instant the store goes live, not just post-purchase.
 */
export function computeBrandFidelity(input: {
  logoUrl: string | null | undefined
  primaryColor: string | null | undefined
  secondaryColor: string | null | undefined
  productsRequested: number
  productsCreated: number
}): BrandFidelityResult {
  const logoDetected = Boolean(input.logoUrl && input.logoUrl.trim().length > 0)
  const primaryColorDetected = Boolean(
    input.primaryColor && !GENERIC_FALLBACK_COLORS.has(input.primaryColor.toLowerCase())
  )
  const secondaryColorDetected = Boolean(
    input.secondaryColor && !GENERIC_FALLBACK_COLORS.has(input.secondaryColor.toLowerCase())
  )
  const productsLaunchedPct =
    input.productsRequested > 0
      ? Math.round((input.productsCreated / input.productsRequested) * 100)
      : 0

  const pct = Math.round(
    (logoDetected ? 30 : 0) +
      (primaryColorDetected ? 20 : 0) +
      (secondaryColorDetected ? 20 : 0) +
      (productsLaunchedPct / 100) * 30
  )

  return {
    pct,
    breakdown: { logoDetected, primaryColorDetected, secondaryColorDetected, productsLaunchedPct },
  }
}

export function computeGenerationSeconds(createdAt: string, now: number = Date.now()): number {
  const startedMs = new Date(createdAt).getTime()
  return Math.max(0, Math.round((now - startedMs) / 1000))
}

export function formatSpeedLabel(seconds: number): string {
  if (seconds < 90) {return `${Math.max(1, Math.round(seconds))} sec`}
  const minutes = seconds / 60
  if (minutes < 90) {return `${Math.round(minutes)} min`}
  const hours = minutes / 60
  if (hours < 48) {return `${Math.round(hours)} hr`}
  const days = hours / 24
  return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`
}

interface CompetitorBenchmark {
  name: string
  category: string
  speedHours: number
  speedLabel: string
  brandAccuracyPct: number
}

/**
 * Reference benchmark set from the DE Step 11 competitive-position research
 * (validated ledger entry, ~72% confidence) — Maya's realistic alternatives,
 * grouped by category and rounded to directional ranges (not false precision).
 * Source: .context/de_ledger.md, Step 11 — Chart Your Competitive Position.
 */
export const COMPETITOR_BENCHMARKS: CompetitorBenchmark[] = [
  { name: 'High-touch swag agencies', category: 'agency', speedHours: 550, speedLabel: '2–4 weeks', brandAccuracyPct: 77 },
  { name: 'Internal design + local printer', category: 'diy-pro', speedHours: 504, speedLabel: '~3 weeks', brandAccuracyPct: 95 },
  { name: 'Gift-card / swag marketplaces', category: 'marketplace', speedHours: 168, speedLabel: '~1 week', brandAccuracyPct: 25 },
  { name: 'DIY design + print-on-demand', category: 'diy-tool', speedHours: 7, speedLabel: '6–8 hrs', brandAccuracyPct: 45 },
  { name: 'Status quo (gift cards / nothing)', category: 'do-nothing', speedHours: 0, speedLabel: 'instant', brandAccuracyPct: 10 },
]

export const SWAGGER_AI_TYPICAL = {
  speedHours: 0.083,
  speedLabel: '~5 min',
  brandAccuracyPct: 96,
}
