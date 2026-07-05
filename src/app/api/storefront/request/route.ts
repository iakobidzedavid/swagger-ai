import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeBrandFidelity, computeGenerationSeconds } from '@/lib/competitive-position'
import { fulfillStorefrontRequest } from '@/lib/storefront-fulfillment'

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export async function POST(req: NextRequest) {
  let body: {
    domain_submission_id?: string
    domain?: string
    company_name?: string
    logo_url?: string | null
    primary_color?: string
    secondary_color?: string
    contact_name?: string
    contact_email?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const domain = (body.domain ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  if (!domain || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: 'Valid domain is required' }, { status: 400 })
  }

  // DE Step 11 (Chart Your Competitive Position): this is the fast, no-signup
  // path (domain → brand colors → submit), so there's no product-selection
  // step to measure yet — score brand fidelity from the assets actually
  // detected and measure speed-to-launch from when the buyer first submitted
  // their domain (domain_submissions.created_at), not from this instant.
  let journeyStartedAt: string | null = null
  if (body.domain_submission_id) {
    const { data: submission } = await supabase
      .from('domain_submissions')
      .select('created_at')
      .eq('id', body.domain_submission_id)
      .single()
    journeyStartedAt = submission?.created_at ?? null
  }
  const generationSeconds = computeGenerationSeconds(journeyStartedAt ?? new Date().toISOString())
  const { pct: brandFidelityPct, breakdown: brandFidelityBreakdown } = computeBrandFidelity({
    logoUrl: body.logo_url,
    primaryColor: body.primary_color,
    secondaryColor: body.secondary_color,
    productsRequested: 0,
    productsCreated: 0,
  })

  const { data, error } = await supabase
    .from('storefront_requests')
    .insert({
      domain_submission_id: body.domain_submission_id ?? null,
      domain,
      company_name: body.company_name ?? null,
      logo_url: body.logo_url ?? null,
      primary_color: body.primary_color ?? null,
      secondary_color: body.secondary_color ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      status: 'queued',
      generation_seconds: generationSeconds,
      brand_fidelity_pct: brandFidelityPct,
      brand_fidelity_breakdown: brandFidelityBreakdown,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Supabase storefront request error:', error)
    return NextResponse.json({ error: 'Failed to queue storefront request' }, { status: 500 })
  }

  // Previously the row was left at status='queued' forever — nothing else in
  // the app ever advanced it (see storefront-fulfillment.ts for the full root
  // cause). Complete it inline with the default product catalog right here so
  // the fast one-click "Continue to Store" path actually finishes, the same
  // way the authenticated /api/storefront/create path does for a manual
  // product selection. If fulfillment throws or times out for any reason, the
  // row simply stays 'queued' and gets picked up the next time anyone reads
  // it (see the self-heal in GET /api/storefront/fetch) — the request itself
  // still succeeded, so this never turns into a 500 for the visitor.
  let finalRow = data
  try {
    const result = await fulfillStorefrontRequest(data.id)
    if (result.status !== 'not_found') {
      finalRow = { ...data, status: result.status }
    }
  } catch (fulfillError) {
    console.error('Storefront fulfillment error (row remains queued):', fulfillError)
  }

  return NextResponse.json(finalRow, { status: 201 })
}
