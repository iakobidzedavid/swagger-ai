import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/admin/printify-diagnostics/product?shopId=X&productId=Y
 *
 * Fetches the live product record straight from Printify (no cache, no
 * Supabase round-trip) — this is what backs the "open a generated SKU" link
 * in the diagnostics UI, so what's shown is always exactly what Printify
 * currently has on file: real mockups, real variant pricing, real status.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.PRINTIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'PRINTIFY_API_KEY not configured' }, { status: 500 })
  }

  const shopId = req.nextUrl.searchParams.get('shopId')
  const productId = req.nextUrl.searchParams.get('productId')
  if (!shopId || !productId) {
    return NextResponse.json({ error: 'shopId and productId query params are required' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${productId}.json`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json().catch(() => null)
    return NextResponse.json({ status: res.status, product: body }, { status: res.ok ? 200 : res.status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
