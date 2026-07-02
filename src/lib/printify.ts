/**
 * Printify API Client
 *
 * Handles authentication and API calls to Printify for:
 * - Getting shop information
 * - Creating products
 * - Retrieving product catalog
 *
 * Falls back to mock mode when PRINTIFY_API_KEY is not provided
 */

export interface PrintifyShop {
  id: string
  title: string
  currency: string
}

export interface PrintifyProduct {
  id: string
  title: string
  description: string
  images: Array<{ src: string }>
  variants: Array<{
    id: string
    title: string
    price: number
    sku: string
  }>
  print_areas: Array<{
    id: string
    title: string
  }>
}

export interface PrintifyProductResponse {
  id: string
  title: string
  description: string
  images: Array<{ src: string }>
  variants: Array<{ id: string; title: string; price: number; sku: string }>
  status: string
}

export class PrintifyClient {
  private apiKey: string | null
  private baseUrl = 'https://api.printify.com/v1'
  private mockMode: boolean

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PRINTIFY_API_KEY || null
    this.mockMode = !this.apiKey
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (this.mockMode) {
      console.warn('[Printify] Running in mock mode — API key not configured')
      throw new Error(
        'Printify API key not configured. Set PRINTIFY_API_KEY environment variable to enable real API calls.'
      )
    }

    if (!this.apiKey) {
      throw new Error('Printify API key is required')
    }

    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Printify API error [${response.status}]: ${JSON.stringify(errorData)}`
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Get shop info — requires a shop ID from the user's Printify account
   */
  async getShop(shopId: string): Promise<PrintifyShop> {
    if (this.mockMode) {
      return {
        id: shopId,
        title: `Mock Shop ${shopId}`,
        currency: 'USD',
      }
    }
    return this.request<PrintifyShop>('GET', `/shops/${shopId}`)
  }

  /**
   * Create a product in Printify
   *
   * @param shopId The Printify shop ID
   * @param productData Product data with brand colors applied
   */
  async createProduct(
    shopId: string,
    productData: {
      title: string
      description: string
      images: Array<{ src: string }>
      variants: Array<{
        id: string | number
        title: string
        price: number
        sku: string
      }>
      print_areas?: Array<{
        id: string
        title: string
      }>
    }
  ): Promise<PrintifyProductResponse> {
    if (this.mockMode) {
      return {
        id: `mock-product-${Date.now()}`,
        title: productData.title,
        description: productData.description,
        images: productData.images,
        variants: productData.variants as Array<{ id: string; title: string; price: number; sku: string }>,
        status: 'draft',
      }
    }

    return this.request<PrintifyProductResponse>('POST', `/shops/${shopId}/products`, productData)
  }

  /**
   * Get all products in a shop
   */
  async getProducts(shopId: string, limit = 100): Promise<Array<PrintifyProduct>> {
    if (this.mockMode) {
      return []
    }

    const response = await this.request<{ data: PrintifyProduct[] }>('GET', `/shops/${shopId}/products?limit=${limit}`)
    return response.data
  }

  /**
   * Get catalog of available base products (templates)
   */
  async getCatalogProducts(limit = 100): Promise<Array<{ id: string; title: string; description: string }>> {
    if (this.mockMode) {
      // Return mock catalog
      return [
        { id: 't-shirt-1', title: 'Classic T-Shirt', description: 'Premium cotton' },
        { id: 'hoodie-1', title: 'Hoodie', description: 'Comfortable hoodie' },
        { id: 'mug-1', title: 'Coffee Mug', description: '11oz ceramic mug' },
      ]
    }

    const response = await this.request<{ data: Array<{ id: string; title: string; description: string }> }>(
      'GET',
      `/catalog/products?limit=${limit}`
    )
    return response.data
  }

  /**
   * Check if we're in mock mode (API key not configured)
   */
  isMockMode(): boolean {
    return this.mockMode
  }
}

export function getPrintifyClient(): PrintifyClient {
  return new PrintifyClient()
}
