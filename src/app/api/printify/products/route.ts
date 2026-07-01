import { NextRequest, NextResponse } from 'next/server'

interface ProductVariant {
  id: string
  title: string
  price: number
}

interface PrintifyProduct {
  id: string
  title: string
  description: string
  category: string
  image: string
  variants: ProductVariant[]
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

/**
 * Mock Printify product catalog — 8-12 AI-curated products
 * In production, these would be fetched from Printify API:
 * https://api.printify.com/v1/catalog/products
 */
const CURATED_PRODUCTS: PrintifyProduct[] = [
  {
    id: 'printify-001',
    title: 'Classic T-Shirt',
    description: 'Premium 100% cotton unisex t-shirt',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/000000/ffffff?text=T-Shirt',
    variants: [{ id: 'v1', title: 'Small', price: 18 }],
    sku: 'TSHIRT-UNISEX-001',
  },
  {
    id: 'printify-002',
    title: 'Hoodie',
    description: 'Comfortable cotton blend hoodie with drawstrings',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/333333/ffffff?text=Hoodie',
    variants: [{ id: 'v1', title: 'Small', price: 42 }],
    sku: 'HOODIE-UNISEX-001',
  },
  {
    id: 'printify-003',
    title: 'Coffee Mug',
    description: '11oz ceramic coffee mug with glossy finish',
    category: 'drinkware',
    image: 'https://via.placeholder.com/300x300/ffffff/000000?text=Mug',
    variants: [{ id: 'v1', title: 'Standard', price: 12 }],
    sku: 'MUG-11OZ-001',
  },
  {
    id: 'printify-004',
    title: 'Water Bottle',
    description: 'Insulated 20oz stainless steel water bottle',
    category: 'drinkware',
    image: 'https://via.placeholder.com/300x300/4a90e2/ffffff?text=Bottle',
    variants: [{ id: 'v1', title: 'Standard', price: 24 }],
    sku: 'BOTTLE-20OZ-001',
  },
  {
    id: 'printify-005',
    title: 'Baseball Cap',
    description: 'Structured 6-panel cotton baseball cap',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/555555/ffffff?text=Cap',
    variants: [{ id: 'v1', title: 'One Size', price: 20 }],
    sku: 'CAP-6PANEL-001',
  },
  {
    id: 'printify-006',
    title: 'Sweatpants',
    description: 'Cozy fleece-lined sweatpants with pockets',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/666666/ffffff?text=Sweatpants',
    variants: [{ id: 'v1', title: 'Small', price: 32 }],
    sku: 'SWEATPANTS-001',
  },
  {
    id: 'printify-007',
    title: 'Tote Bag',
    description: 'Durable canvas tote bag with long handles',
    category: 'accessories',
    image: 'https://via.placeholder.com/300x300/dddddd/000000?text=Tote',
    variants: [{ id: 'v1', title: 'Standard', price: 16 }],
    sku: 'TOTE-CANVAS-001',
  },
  {
    id: 'printify-008',
    title: 'Beanie',
    description: 'Warm acrylic knit beanie available in multiple colors',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/888888/ffffff?text=Beanie',
    variants: [{ id: 'v1', title: 'One Size', price: 14 }],
    sku: 'BEANIE-ACRYLIC-001',
  },
  {
    id: 'printify-009',
    title: 'Drawstring Bag',
    description: 'Lightweight drawstring backpack for daily carry',
    category: 'accessories',
    image: 'https://via.placeholder.com/300x300/777777/ffffff?text=Drawstring',
    variants: [{ id: 'v1', title: 'Standard', price: 18 }],
    sku: 'BAG-DRAWSTRING-001',
  },
  {
    id: 'printify-010',
    title: 'Polo Shirt',
    description: 'Classic pique cotton polo shirt',
    category: 'apparel',
    image: 'https://via.placeholder.com/300x300/1a1a1a/ffffff?text=Polo',
    variants: [{ id: 'v1', title: 'Small', price: 28 }],
    sku: 'POLO-PIQUE-001',
  },
]

export interface ProductsResponse {
  products: PrintifyProduct[]
  count: number
  primaryColor?: string
  secondaryColor?: string
}

/**
 * GET /api/printify/products
 *
 * Fetch AI-curated Printify products for a domain/store.
 * Returns 8-12 products prioritized by apparel and drinkware categories.
 *
 * Query parameters:
 *   - domain (optional): company domain to fetch products for
 *   - primaryColor (optional): brand primary color for mockup
 *   - secondaryColor (optional): brand secondary color for mockup
 *
 * NOTE: This is a mock implementation. In production, this would:
 * 1. Call Printify API with a valid OAuth token
 * 2. Filter/curate products based on brand guidelines
 * 3. Generate branded mockups using Printify's design service
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  const primaryColor = req.nextUrl.searchParams.get('primaryColor') ?? '#7c3aed'
  const secondaryColor = req.nextUrl.searchParams.get('secondaryColor') ?? '#8fa3b8'

  // Priority ordering: apparel first (t-shirts, hoodies, etc.), then drinkware
  const prioritized = [...CURATED_PRODUCTS].sort((a, b) => {
    const aPriority = a.category === 'apparel' ? 0 : a.category === 'drinkware' ? 1 : 2
    const bPriority = b.category === 'apparel' ? 0 : b.category === 'drinkware' ? 1 : 2
    return aPriority - bPriority
  })

  // Return 8-12 products (all of them for now)
  const products = prioritized.slice(0, 12).map(p => ({
    ...p,
    primaryColor,
    secondaryColor,
  }))

  const response: ProductsResponse = {
    products,
    count: products.length,
    primaryColor,
    secondaryColor,
  }

  return NextResponse.json(response, { status: 200 })
}
