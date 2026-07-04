import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/printify-diagnostics
 *
 * Authenticated real-connectivity check against the live Printify account behind
 * PRINTIFY_API_KEY: lists real shops and a sample of the real catalog. Used to
 * verify the account has a usable shop before the storefront pipeline creates
 * real products, and to confirm the catalog fetch path isn't silently falling
 * back to curated placeholder data.
 *
 * Requires: Authorization: Bearer <signed-in JWT> (same auth as /api/storefront/create)
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.PRINTIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'PRINTIFY_API_KEY not configured' }, { status: 500 })
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const result: Record<string, unknown> = {}

  try {
    const shopsRes = await fetch('https://api.printify.com/v1/shops.json', { headers })
    result.shopsStatus = shopsRes.status
    result.shops = shopsRes.ok ? await shopsRes.json() : await shopsRes.text()
  } catch (err) {
    result.shopsError = err instanceof Error ? err.message : String(err)
  }

  try {
    const blueprintsRes = await fetch('https://api.printify.com/v1/catalog/blueprints.json', { headers })
    result.blueprintsStatus = blueprintsRes.status
    if (blueprintsRes.ok) {
      const data = await blueprintsRes.json()
      result.blueprintsCount = Array.isArray(data) ? data.length : undefined
      result.blueprintsSample = Array.isArray(data) ? data.slice(0, 5) : data
    } else {
      result.blueprintsError = await blueprintsRes.text()
    }
  } catch (err) {
    result.blueprintsError = err instanceof Error ? err.message : String(err)
  }

  const shops = Array.isArray(result.shops) ? result.shops as Array<{ id: number | string }> : undefined
  const firstShopId = shops?.[0]?.id

  if (firstShopId) {
    try {
      const productsRes = await fetch(`https://api.printify.com/v1/shops/${firstShopId}/products.json`, { headers })
      result.firstShopProductsStatus = productsRes.status
      result.firstShopProducts = productsRes.ok ? await productsRes.json() : await productsRes.text()
    } catch (err) {
      result.firstShopProductsError = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json(result, { status: 200 })
}
