import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface StorefrontData {
  id: string
  domain: string
  company_name: string | null
  store_name: string | null
  store_description: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  status: string
  created_at: string
  updated_at: string
}

/**
 * GET /api/admin/storefronts
 *
 * Fetch all storefronts (limited by status or domain for now)
 * In a real app, this would be filtered by authenticated user/account
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const domain = searchParams.get('domain')

    let query = supabase
      .from('storefront_requests')
      .select(
        'id, domain, company_name, store_name, store_description, logo_url, primary_color, secondary_color, status, created_at, updated_at'
      )
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(50)

    // Filter by domain if provided
    if (domain) {
      query = query.ilike('domain', `%${domain}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching storefronts:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      storefronts: data as StorefrontData[],
    })
  } catch (err) {
    console.error('Error in GET /api/admin/storefronts:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface StorefrontSettingsUpdate {
  id: string
  company_name?: string
  store_name?: string
  store_description?: string
  logo_url?: string | null
  primary_color?: string
  secondary_color?: string
}

/**
 * PATCH /api/admin/storefronts
 *
 * Update a specific storefront's settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const body: StorefrontSettingsUpdate = await req.json()
    const { id, company_name, store_name, store_description, logo_url, primary_color, secondary_color } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Storefront ID is required' },
        { status: 400 }
      )
    }

    // Validate color formats if provided
    const colorRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/
    if (primary_color && !colorRegex.test(primary_color)) {
      return NextResponse.json(
        { success: false, error: 'primary_color must be a valid hex color (e.g., #FF5733)' },
        { status: 400 }
      )
    }
    if (secondary_color && !colorRegex.test(secondary_color)) {
      return NextResponse.json(
        { success: false, error: 'secondary_color must be a valid hex color (e.g., #FF5733)' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (company_name !== undefined) updateData.company_name = company_name
    if (store_name !== undefined) updateData.store_name = store_name
    if (store_description !== undefined) updateData.store_description = store_description
    if (logo_url !== undefined) updateData.logo_url = logo_url
    if (primary_color !== undefined) updateData.primary_color = primary_color
    if (secondary_color !== undefined) updateData.secondary_color = secondary_color

    const { data, error } = await supabase
      .from('storefront_requests')
      .update(updateData)
      .eq('id', id)
      .select(
        'id, domain, company_name, store_name, store_description, logo_url, primary_color, secondary_color, status, created_at, updated_at'
      )
      .single()

    if (error || !data) {
      console.error('Error updating storefront:', error)
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to update storefront' },
        { status: error?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Storefront updated successfully',
      storefront: data as StorefrontData,
    })
  } catch (err) {
    console.error('Error in PATCH /api/admin/storefronts:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
