import { NextRequest, NextResponse } from 'next/server'
import { generateMockup, createMockupCacheKey } from '@/lib/mockup-generator'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client (service role for server-side ops)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase credentials not configured')
  }
  return createClient(url, key)
}

export interface GenerateMockupRequest {
  productId: string
  productTitle: string
  productCategory: 'apparel' | 'drinkware' | 'accessories'
  domain: string
  companyName: string
  primaryColor: string
  secondaryColor: string
  logoUrl?: string | null
}

export interface GenerateMockupResponse {
  success: boolean
  mockupDataUrl: string
  mockupSvg?: string
  cacheKey: string
  cached: boolean
  message?: string
}

/**
 * POST /api/design-engine/generate-mockup
 *
 * Generate a branded product mockup and cache it in Supabase.
 * Returns the mockup as a data URL for immediate display.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateMockupRequest

    // Validate required fields
    if (
      !body.productId ||
      !body.productTitle ||
      !body.productCategory ||
      !body.domain ||
      !body.companyName ||
      !body.primaryColor ||
      !body.secondaryColor
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create cache key
    const cacheKey = createMockupCacheKey(
      body.productId,
      body.domain,
      body.primaryColor,
      body.secondaryColor
    )

    // Check if mockup already exists in cache
    const supabase = getSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('product_mockups')
      .select('mockup_data_url, mockup_svg')
      .eq('mockup_cache_key', cacheKey)
      .single()

    if (!fetchError && existing) {
      // Return cached mockup
      return NextResponse.json({
        success: true,
        mockupDataUrl: existing.mockup_data_url || '',
        mockupSvg: existing.mockup_svg,
        cacheKey,
        cached: true,
        message: 'Retrieved from cache',
      } as GenerateMockupResponse)
    }

    // Generate new mockup
    const mockup = generateMockup({
      productId: body.productId,
      productTitle: body.productTitle,
      productCategory: body.productCategory,
      logoUrl: body.logoUrl || null,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      companyName: body.companyName,
    })

    // Cache in Supabase
    const { error: insertError } = await supabase.from('product_mockups').insert({
      product_id: body.productId,
      domain: body.domain,
      company_name: body.companyName,
      primary_color: body.primaryColor,
      secondary_color: body.secondaryColor,
      logo_url: body.logoUrl || null,
      mockup_svg: mockup.svg,
      mockup_data_url: mockup.dataUrl,
      mockup_cache_key: cacheKey,
      product_title: body.productTitle,
      product_category: body.productCategory,
    })

    if (insertError) {
      console.warn('Failed to cache mockup in Supabase:', insertError)
      // Continue anyway — mockup was generated, just not cached
    }

    return NextResponse.json({
      success: true,
      mockupDataUrl: mockup.dataUrl,
      mockupSvg: mockup.svg,
      cacheKey,
      cached: false,
      message: 'Mockup generated successfully',
    } as GenerateMockupResponse)
  } catch (error) {
    console.error('Mockup generation error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate mockup',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/design-engine/generate-mockup?cacheKey=...
 *
 * Retrieve a cached mockup by cache key.
 */
export async function GET(req: NextRequest) {
  try {
    const cacheKey = req.nextUrl.searchParams.get('cacheKey')

    if (!cacheKey) {
      return NextResponse.json(
        { success: false, message: 'cacheKey parameter required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('product_mockups')
      .select('mockup_data_url, mockup_svg, product_title, product_category')
      .eq('mockup_cache_key', cacheKey)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Mockup not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      mockupDataUrl: data.mockup_data_url || '',
      mockupSvg: data.mockup_svg,
      cacheKey,
      cached: true,
    } as GenerateMockupResponse)
  } catch (error) {
    console.error('Mockup retrieval error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve mockup',
      },
      { status: 500 }
    )
  }
}
