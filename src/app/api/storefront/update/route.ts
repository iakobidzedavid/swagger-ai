import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface StorefrontUpdateRequest {
  storefrontRequestId: string
  secondaryColor?: string
  primaryColor?: string
  companyName?: string
  logoUrl?: string | null
}

interface StorefrontUpdateResponse {
  success: boolean
  message?: string
  error?: string
  data?: {
    id: string
    domain: string
    primaryColor: string | null
    secondaryColor: string | null
    companyName: string | null
    logoUrl: string | null
  }
}

/**
 * PATCH /api/storefront/update
 *
 * Update storefront branding properties (secondary color, primary color, company name, logo).
 * This allows stores to modify their colors and branding after initial creation.
 *
 * Request body:
 * {
 *   storefrontRequestId: string (required)
 *   secondaryColor?: string (e.g., "#FF5733")
 *   primaryColor?: string
 *   companyName?: string
 *   logoUrl?: string | null
 * }
 */
export async function PATCH(req: NextRequest) {
  let body: StorefrontUpdateRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json<StorefrontUpdateResponse>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { storefrontRequestId, secondaryColor, primaryColor, companyName, logoUrl } = body

  if (!storefrontRequestId) {
    return NextResponse.json<StorefrontUpdateResponse>(
      { success: false, error: 'storefrontRequestId is required' },
      { status: 400 }
    )
  }

  // Validate color formats if provided
  const colorRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/
  if (secondaryColor && !colorRegex.test(secondaryColor)) {
    return NextResponse.json<StorefrontUpdateResponse>(
      { success: false, error: 'secondaryColor must be a valid hex color (e.g., #FF5733)' },
      { status: 400 }
    )
  }
  if (primaryColor && !colorRegex.test(primaryColor)) {
    return NextResponse.json<StorefrontUpdateResponse>(
      { success: false, error: 'primaryColor must be a valid hex color (e.g., #FF5733)' },
      { status: 400 }
    )
  }

  try {
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (secondaryColor !== undefined) {
      updateData.secondary_color = secondaryColor
    }
    if (primaryColor !== undefined) {
      updateData.primary_color = primaryColor
    }
    if (companyName !== undefined) {
      updateData.company_name = companyName
    }
    if (logoUrl !== undefined) {
      updateData.logo_url = logoUrl
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 1) {
      // Only updated_at was set
      return NextResponse.json<StorefrontUpdateResponse>(
        { success: false, error: 'At least one field (secondaryColor, primaryColor, companyName, or logoUrl) must be provided' },
        { status: 400 }
      )
    }

    // Update the storefront_requests record
    const { data, error } = await supabase
      .from('storefront_requests')
      .update(updateData)
      .eq('id', storefrontRequestId)
      .select('id, domain, primary_color, secondary_color, company_name, logo_url')
      .single()

    if (error || !data) {
      console.error('Supabase storefront update error:', error)
      return NextResponse.json<StorefrontUpdateResponse>(
        { success: false, error: error?.message || 'Failed to update storefront' },
        { status: error?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json<StorefrontUpdateResponse>(
      {
        success: true,
        message: 'Storefront updated successfully',
        data: {
          id: data.id,
          domain: data.domain,
          primaryColor: data.primary_color,
          secondaryColor: data.secondary_color,
          companyName: data.company_name,
          logoUrl: data.logo_url,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error updating storefront:', err)
    return NextResponse.json<StorefrontUpdateResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
