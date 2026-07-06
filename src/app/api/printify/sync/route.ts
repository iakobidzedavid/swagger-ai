import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getPrintifyClient } from '@/lib/printify'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface SyncProductRequest {
  storefrontRequestId: string
  productId: string
  printifyId: string
  shopId: string
}

interface SyncResponse {
  success: boolean
  message: string
  product?: {
    id: string
    printifyId: string
    name: string
    updatedPrice?: number
    variantCount?: number
    lastSyncedAt: string
  }
}

/**
 * POST /api/printify/sync
 *
 * Sync a specific product's data from Printify API back to our database.
 *
 * This endpoint:
 * 1. Fetches the product from Printify API using the shop ID and product ID
 * 2. Updates the product record in our database with the latest data
 * 3. Tracks the sync timestamp for audit purposes
 *
 * Request body:
 * - storefrontRequestId: UUID of the storefront request
 * - productId: Our local product UUID
 * - printifyId: Printify's product ID
 * - shopId: Printify shop ID
 */
export async function POST(req: NextRequest) {
  let body: SyncProductRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { storefrontRequestId, productId, printifyId, shopId } = body

  // Validate required fields
  if (!storefrontRequestId || !productId || !printifyId || !shopId) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required fields: storefrontRequestId, productId, printifyId, shopId',
      },
      { status: 400 }
    )
  }

  try {
    const printifyClient = getPrintifyClient()

    // Step 1: Fetch product from Printify
    let printifyProduct
    try {
      printifyProduct = await printifyClient.getProduct(shopId, printifyId)
    } catch (err) {
      console.error('Error fetching product from Printify:', err)

      // Update sync status to failed
      await supabase
        .from('printify_products')
        .update({
          sync_status: 'failed',
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', productId)

      return NextResponse.json(
        {
          success: false,
          message: `Failed to fetch product from Printify: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      )
    }

    // Step 2: Update product in our database with fresh data from Printify
    const firstVariant = printifyProduct.variants?.[0]
    const updatedPrice = firstVariant?.price ? Math.round(firstVariant.price / 100) : undefined

    const { data: updatedProduct, error: updateError } = await supabase
      .from('printify_products')
      .update({
        name: printifyProduct.title,
        description: printifyProduct.description,
        price_usd: updatedPrice || 0,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single()

    if (updateError || !updatedProduct) {
      console.error('Error updating product in database:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update product in database' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Product synced successfully',
        product: {
          id: updatedProduct.id,
          printifyId: updatedProduct.printify_id,
          name: updatedProduct.name,
          updatedPrice: updatedProduct.price_usd,
          variantCount: printifyProduct.variants?.length || 0,
          lastSyncedAt: updatedProduct.last_synced_at,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error in sync endpoint:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/printify/sync (bulk)
 *
 * Sync all products for a storefront from Printify back to database
 *
 * Request body:
 * - storefrontRequestId: UUID of the storefront request
 * - shopId: Printify shop ID
 */
interface BulkSyncRequest {
  storefrontRequestId: string
  shopId: string
}

interface BulkSyncResponse {
  success: boolean
  message: string
  syncedCount: number
  failedCount: number
  products?: Array<{
    id: string
    name: string
    syncStatus: string
  }>
}

export async function PUT(req: NextRequest) {
  let body: BulkSyncRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { storefrontRequestId, shopId } = body

  if (!storefrontRequestId || !shopId) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required fields: storefrontRequestId, shopId',
      },
      { status: 400 }
    )
  }

  try {
    // Fetch all products for this storefront
    const { data: products, error: fetchError } = await supabase
      .from('printify_products')
      .select('id, printify_id')
      .eq('storefront_request_id', storefrontRequestId)

    if (fetchError || !products) {
      console.error('Error fetching products:', fetchError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    if (products.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No products to sync',
          syncedCount: 0,
          failedCount: 0,
        },
        { status: 200 }
      )
    }

    // Sync each product
    const syncPromises = products.map((product) =>
      fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/printify/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontRequestId,
          productId: product.id,
          printifyId: product.printify_id,
          shopId,
        }),
      })
        .then((res) => res.json())
        .then((result) => ({
          success: result.success,
          productId: product.id,
          name: result.product?.name || result.error || 'Unknown',
        }))
        .catch((err) => ({
          success: false,
          productId: product.id,
          name: 'Sync error',
        }))
    )

    const syncResults = await Promise.all(syncPromises)
    const syncedCount = syncResults.filter((r) => r.success).length
    const failedCount = syncResults.filter((r) => !r.success).length

    return NextResponse.json(
      {
        success: failedCount === 0,
        message: `Synced ${syncedCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        syncedCount,
        failedCount,
        products: syncResults.map((r) => ({
          id: r.productId,
          name: r.name,
          syncStatus: r.success ? 'synced' : 'failed',
        })),
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error in bulk sync endpoint:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
