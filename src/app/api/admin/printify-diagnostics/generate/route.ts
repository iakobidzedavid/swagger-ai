import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchBrandData } from '@/lib/brandfetch'

export const runtime = 'nodejs'
// 60s is the highest maxDuration Vercel accepts on every plan tier (Hobby included);
// a higher value here fails Vercel's deploy-time validation and the whole
// deployment falls back to the previous build, 404ing every new route.
export const maxDuration = 60

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

// Keywords used to pull a diverse 8-12 SKU spread out of Printify's REAL,
// live blueprint catalog (fetched fresh on every run — nothing hardcoded).
const SKU_KEYWORDS: Array<{ keyword: string; category: string; label: string; price: number }> = [
  { keyword: 'heavy cotton tee', category: 'apparel', label: 'Classic Tee', price: 24 },
  { keyword: 'hoodie', category: 'apparel', label: 'Hoodie', price: 45 },
  { keyword: 'mug', category: 'drinkware', label: 'Coffee Mug', price: 14 },
  { keyword: 'water bottle', category: 'drinkware', label: 'Water Bottle', price: 26 },
  { keyword: 'snapback', category: 'apparel', label: 'Snapback Cap', price: 22 },
  { keyword: 'tote bag', category: 'accessories', label: 'Tote Bag', price: 18 },
  { keyword: 'beanie', category: 'apparel', label: 'Beanie', price: 16 },
  { keyword: 'tank top', category: 'apparel', label: 'Tank Top', price: 20 },
  { keyword: 'crewneck sweatshirt', category: 'apparel', label: 'Sweatshirt', price: 38 },
  { keyword: 'phone case', category: 'accessories', label: 'Phone Case', price: 19 },
  { keyword: 'spiral notebook', category: 'accessories', label: 'Notebook', price: 12 },
  { keyword: 'sticker', category: 'accessories', label: 'Sticker Pack', price: 6 },
]

interface Blueprint { id: number; title: string }
interface PrintProvider { id: number; title: string }
interface Variant { id: number; title: string; is_enabled?: boolean }

interface PipelineStep {
  step: string
  label: string
  startedAt: string
  completedAt: string
  durationMs: number
  detail: Record<string, unknown>
}

interface SkuResult {
  label: string
  category: string
  blueprintId: number
  blueprintTitle: string
  printProviderId: number
  printProviderTitle: string
  variantId: number
  status: 'created' | 'failed'
  printifyProductId?: string
  title?: string
  mockupImageUrl?: string
  priceUsd?: number
  error?: string
}

function printifyHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

async function printifyFetch(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    ...init,
    headers: { ...printifyHeaders(apiKey), ...(init?.headers || {}) },
  })
  const status = res.status
  const body = await res.json().catch(() => null)
  return { status, ok: res.ok, body }
}

export async function POST(req: NextRequest) {
  const pipeline: PipelineStep[] = []
  const overallStart = Date.now()

  let body: { domain?: string; skuCount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = (body.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const targetSkuCount = Math.min(Math.max(body.skuCount ?? 10, 8), 12)

  const stepStart = () => Date.now()
  const pushStep = (step: string, label: string, start: number, detail: Record<string, unknown>) => {
    const completed = Date.now()
    pipeline.push({
      step,
      label,
      startedAt: new Date(start).toISOString(),
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - start,
      detail,
    })
  }

  // Step 1: domain parsing
  const s1 = stepStart()
  if (!raw || !DOMAIN_RE.test(raw)) {
    pushStep('domain_parsing', 'Domain parsing', s1, { domain: raw, valid: false })
    return NextResponse.json({ error: 'Invalid domain format', pipeline }, { status: 400 })
  }
  pushStep('domain_parsing', 'Domain parsing', s1, { domain: raw, valid: true })

  const apiKey = process.env.PRINTIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'PRINTIFY_API_KEY not configured — cannot reach the live Printify API', pipeline },
      { status: 500 }
    )
  }

  // Step 2: brand extraction (real Brandfetch/keyless lookup — same function every other route uses)
  const s2 = stepStart()
  const brand = await fetchBrandData(raw)
  pushStep('brand_extraction', 'Brand extraction', s2, {
    companyName: brand.companyName,
    source: brand.source,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    colorCount: brand.colors?.length ?? 0,
    fontCount: brand.fonts?.length ?? 0,
  })

  // Step 3: resolve the real Printify shop tied to PRINTIFY_API_KEY
  const s3 = stepStart()
  const shopsResp = await printifyFetch('/shops.json', apiKey)
  if (!shopsResp.ok || !Array.isArray(shopsResp.body) || shopsResp.body.length === 0) {
    pushStep('printify_shop', 'Resolve Printify shop', s3, { status: shopsResp.status, shopsFound: 0 })
    return NextResponse.json(
      {
        error: 'No Printify shop is reachable with the configured PRINTIFY_API_KEY',
        printifyStatus: shopsResp.status,
        printifyResponse: shopsResp.body,
        pipeline,
      },
      { status: 502 }
    )
  }
  const shop = shopsResp.body[0] as { id: number; title: string }
  pushStep('printify_shop', 'Resolve Printify shop', s3, { shopId: shop.id, shopTitle: shop.title })

  // Step 4: SKU design — pull real blueprints/providers/variants from Printify's live catalog
  const s4 = stepStart()
  const blueprintsResp = await printifyFetch('/catalog/blueprints.json', apiKey)
  const blueprints: Blueprint[] = Array.isArray(blueprintsResp.body) ? blueprintsResp.body : []

  const skuPlans: Array<{ keyword: string; category: string; label: string; price: number; blueprint: Blueprint }> = []
  for (const spec of SKU_KEYWORDS) {
    if (skuPlans.length >= targetSkuCount) break
    const match = blueprints.find(bp => bp.title?.toLowerCase().includes(spec.keyword))
    if (match) skuPlans.push({ ...spec, blueprint: match })
  }
  pushStep('sku_design', 'SKU design (blueprint selection)', s4, {
    blueprintsAvailable: blueprints.length,
    skusSelected: skuPlans.length,
    skus: skuPlans.map(p => ({ label: p.label, blueprintId: p.blueprint.id, blueprintTitle: p.blueprint.title })),
  })

  if (skuPlans.length === 0) {
    return NextResponse.json(
      { error: 'Live Printify catalog returned no matching blueprints for SKU design', pipeline },
      { status: 502 }
    )
  }

  // Step 5: upload one print-ready brand asset (the real favicon for this domain) that every SKU prints
  const s5 = stepStart()
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(raw)}&sz=256`
  const uploadResp = await printifyFetch('/uploads/images.json', apiKey, {
    method: 'POST',
    body: JSON.stringify({ file_name: `${raw}-mark.png`, url: faviconUrl }),
  })
  const uploadedImageId = uploadResp.ok ? (uploadResp.body as { id?: string })?.id : undefined
  pushStep('asset_upload', 'Upload print-ready brand asset to Printify', s5, {
    status: uploadResp.status,
    imageId: uploadedImageId,
    sourceUrl: faviconUrl,
  })

  if (!uploadedImageId) {
    return NextResponse.json(
      {
        error: 'Failed to upload brand asset to Printify',
        printifyStatus: uploadResp.status,
        printifyResponse: uploadResp.body,
        pipeline,
      },
      { status: 502 }
    )
  }

  // Step 6: Printify integration — resolve a print provider + variant per blueprint, then create the real product
  const s6 = stepStart()
  const skuResults: SkuResult[] = []

  // Persist a storefront_requests row so this run leaves a real, queryable trail
  const { data: storefrontRequest } = await supabase
    .from('storefront_requests')
    .insert({
      domain: raw,
      company_name: brand.companyName,
      logo_url: brand.logoUrl,
      primary_color: brand.primaryColor,
      secondary_color: brand.secondaryColor,
      design_template: 'diagnostics-test',
      status: 'processing',
    })
    .select()
    .single()

  // Each SKU's provider/variant/create-product calls are independent of the others,
  // so run them concurrently — sequential awaits over 8-12 SKUs risk tripping the
  // function's maxDuration under normal Printify API latency.
  const createdSkus = await Promise.all(
    skuPlans.map(async plan => {
      try {
        const providersResp = await printifyFetch(`/catalog/blueprints/${plan.blueprint.id}/print_providers.json`, apiKey)
        const providers: PrintProvider[] = Array.isArray(providersResp.body) ? providersResp.body : []
        const provider = providers[0]
        if (!provider) throw new Error('No print provider available for this blueprint')

        const variantsResp = await printifyFetch(
          `/catalog/blueprints/${plan.blueprint.id}/print_providers/${provider.id}/variants.json`,
          apiKey
        )
        const variantList: Variant[] = Array.isArray((variantsResp.body as { variants?: Variant[] })?.variants)
          ? (variantsResp.body as { variants: Variant[] }).variants
          : []
        const variant = variantList.find(v => v.is_enabled !== false) || variantList[0]
        if (!variant) throw new Error('No variant available for this blueprint/provider pair')

        const createResp = await printifyFetch(`/shops/${shop.id}/products.json`, apiKey, {
          method: 'POST',
          body: JSON.stringify({
            title: `${brand.companyName} ${plan.label}`,
            description: `${plan.label} branded for ${brand.companyName} (${raw}) — generated by the Swagger AI diagnostics pipeline.`,
            blueprint_id: plan.blueprint.id,
            print_provider_id: provider.id,
            variants: [{ id: variant.id, price: Math.round(plan.price * 100), is_enabled: true }],
            print_areas: [
              {
                variant_ids: [variant.id],
                placeholders: [
                  {
                    position: 'front',
                    images: [{ id: uploadedImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
                  },
                ],
              },
            ],
          }),
        })

        if (!createResp.ok) {
          throw new Error(`Printify create-product [${createResp.status}]: ${JSON.stringify(createResp.body)}`)
        }

        const product = createResp.body as {
          id: string
          title: string
          images?: Array<{ src: string; is_default?: boolean }>
        }
        const mockup = product.images?.find(i => i.is_default) || product.images?.[0]

        const sku: SkuResult = {
          label: plan.label,
          category: plan.category,
          blueprintId: plan.blueprint.id,
          blueprintTitle: plan.blueprint.title,
          printProviderId: provider.id,
          printProviderTitle: provider.title,
          variantId: variant.id,
          status: 'created',
          printifyProductId: product.id,
          title: product.title,
          mockupImageUrl: mockup?.src,
          priceUsd: plan.price,
        }
        return { sku, insertRow: storefrontRequest
          ? {
              storefront_request_id: storefrontRequest.id,
              printify_id: product.id,
              name: product.title,
              description: `${plan.label} branded for ${brand.companyName}`,
              category: plan.category,
              image_url: mockup?.src,
              price_usd: plan.price,
              sku: `${raw.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${plan.category.toUpperCase()}-${plan.blueprint.id}`,
              brand_color_primary: brand.primaryColor,
              brand_color_secondary: brand.secondaryColor,
              status: 'active',
            }
          : null }
      } catch (err) {
        const sku: SkuResult = {
          label: plan.label,
          category: plan.category,
          blueprintId: plan.blueprint.id,
          blueprintTitle: plan.blueprint.title,
          printProviderId: 0,
          printProviderTitle: '',
          variantId: 0,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }
        return { sku, insertRow: null }
      }
    })
  )

  skuResults.push(...createdSkus.map(r => r.sku))
  const insertRows = createdSkus.map(r => r.insertRow).filter((row): row is NonNullable<typeof row> => row !== null)
  if (insertRows.length > 0) {
    await supabase.from('printify_products').insert(insertRows)
  }

  pushStep('printify_integration', 'Printify integration (real product creation)', s6, {
    attempted: skuPlans.length,
    created: skuResults.filter(r => r.status === 'created').length,
    failed: skuResults.filter(r => r.status === 'failed').length,
  })

  const createdCount = skuResults.filter(r => r.status === 'created').length
  const finalStatus = createdCount === 0 ? 'failed' : createdCount === skuResults.length ? 'complete' : 'partial'

  if (storefrontRequest) {
    await supabase.from('storefront_requests').update({ status: finalStatus, updated_at: new Date().toISOString() }).eq('id', storefrontRequest.id)
  }

  const totalDurationMs = Date.now() - overallStart

  return NextResponse.json({
    success: createdCount > 0,
    domain: raw,
    companyName: brand.companyName,
    shop: { id: shop.id, title: shop.title },
    storefrontRequestId: storefrontRequest?.id ?? null,
    pipeline,
    skus: skuResults,
    skusCreated: createdCount,
    skusAttempted: skuResults.length,
    totalDurationMs,
    underFiveMinutes: totalDurationMs < 5 * 60 * 1000,
  })
}
