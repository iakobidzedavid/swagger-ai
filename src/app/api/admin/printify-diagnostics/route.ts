import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/admin/printify-diagnostics
 *
 * Read-only, real-connectivity explorer against the live Printify account
 * behind PRINTIFY_API_KEY. Used to verify real shop/catalog access and to look
 * up blueprint -> print-provider -> variant combinations before the storefront
 * pipeline creates real products (Printify requires a valid blueprint_id +
 * print_provider_id + variant ids; there is no flat "create any product"
 * shortcut).
 *
 * Query params:
 *   - mode=overview (default): shops + a small blueprint sample
 *   - mode=search&keyword=hoodie: blueprints whose title matches keyword
 *   - mode=providers&blueprintId=6: print providers offering that blueprint
 *   - mode=variants&blueprintId=6&printProviderId=27: variants for that pair
 *   - mode=shop-products&shopId=26332858: real products currently in a shop
 *
 * No auth required (mirrors the other /admin/* dashboards in this app) — this
 * endpoint is read-only against Printify, it never mutates data.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.PRINTIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'PRINTIFY_API_KEY not configured' }, { status: 500 })
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const mode = req.nextUrl.searchParams.get('mode') || 'overview'

  async function fetchJson(path: string) {
    const res = await fetch(`https://api.printify.com/v1${path}`, { headers })
    const status = res.status
    const body = res.ok ? await res.json() : await res.text()
    return { status, body }
  }

  try {
    if (mode === 'search') {
      const keyword = (req.nextUrl.searchParams.get('keyword') || '').toLowerCase()
      const { status, body } = await fetchJson('/catalog/blueprints.json')
      const list = Array.isArray(body) ? body as Array<{ id: number; title: string; brand?: string; model?: string }> : []
      const matches = list.filter(bp => bp.title?.toLowerCase().includes(keyword)).slice(0, 15)
      return NextResponse.json({ status, count: matches.length, matches })
    }

    if (mode === 'providers') {
      const blueprintId = req.nextUrl.searchParams.get('blueprintId')
      const { status, body } = await fetchJson(`/catalog/blueprints/${blueprintId}/print_providers.json`)
      return NextResponse.json({ status, body })
    }

    if (mode === 'variants') {
      const blueprintId = req.nextUrl.searchParams.get('blueprintId')
      const printProviderId = req.nextUrl.searchParams.get('printProviderId')
      const { status, body } = await fetchJson(`/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`)
      return NextResponse.json({ status, body })
    }

    if (mode === 'shop-products') {
      const shopId = req.nextUrl.searchParams.get('shopId')
      const { status, body } = await fetchJson(`/shops/${shopId}/products.json`)
      return NextResponse.json({ status, body })
    }

    // overview
    const result: Record<string, unknown> = {}
    const shopsResult = await fetchJson('/shops.json')
    result.shopsStatus = shopsResult.status
    result.shops = shopsResult.body

    const blueprintsResult = await fetchJson('/catalog/blueprints.json')
    result.blueprintsStatus = blueprintsResult.status
    result.blueprintsCount = Array.isArray(blueprintsResult.body) ? blueprintsResult.body.length : undefined
    result.blueprintsSample = Array.isArray(blueprintsResult.body) ? blueprintsResult.body.slice(0, 3) : blueprintsResult.body

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
