/**
 * AI-Powered Product Curation via OpenAI
 *
 * When OPENAI_API_KEY is configured, this module enhances product descriptions
 * and recommendations based on the company's brand data. If the key is missing,
 * it gracefully falls back to static product descriptions.
 *
 * Used by storefront fulfillment to add brand-aware product copy and selection.
 */

export interface ProductForCuration {
  id: string
  title: string
  category: string
  description: string
}

export interface CuratedProduct extends ProductForCuration {
  aiDescription?: string
  aiRelevanceScore?: number
}

/**
 * Enhance product descriptions using OpenAI based on brand context
 *
 * @param products — Products to enhance
 * @param companyName — Company name for context
 * @param brandIndustry — Industry/category (inferred from domain or metadata)
 * @returns Products with ai-enhanced descriptions (or original if key unavailable)
 */
export async function curateProductDescriptions(
  products: ProductForCuration[],
  companyName: string,
  brandIndustry?: string
): Promise<CuratedProduct[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // Keyless fallback: return products unchanged
    console.warn(
      '[OpenAI Curator] OPENAI_API_KEY not configured — using default product descriptions. Products will display generic descriptions unless the key is set in production environment variables.'
    )
    return products.map(p => ({ ...p }))
  }

  console.log(`[OpenAI Curator] OPENAI_API_KEY configured, attempting to generate AI descriptions for ${products.length} products for company: ${companyName}`)

  try {
    // Build curation prompt
    const industryContext = brandIndustry ? ` in the ${brandIndustry} industry` : ''
    const productList = products.map(p => `- ${p.title}: ${p.category}`).join('\n')

    const prompt = `You are a product merchandiser for ${companyName}${industryContext}.
Given these swag products to offer employees, provide 1-2 sentence descriptions that:
1. Emphasize quality, daily utility, and professional use
2. Are enthusiastic but authentic (avoid corporate jargon)
3. Mention employee benefits or team-building value

Products to describe:
${productList}

Respond as valid JSON: { "descriptions": { "product-id": "1-2 sentence description", ... } }`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      console.warn(`[OpenAI Curator] API error: ${response.status} — falling back to defaults`)
      return products.map(p => ({ ...p }))
    }

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.warn('[OpenAI Curator] No content in response — falling back to defaults')
      return products.map(p => ({ ...p }))
    }

    // Parse JSON from response
    let descriptions: Record<string, string> = {}
    try {
      const parsed = JSON.parse(content)
      descriptions = parsed.descriptions || {}
    } catch {
      console.warn('[OpenAI Curator] Failed to parse response JSON — falling back to defaults')
      return products.map(p => ({ ...p }))
    }

    // Merge AI descriptions into products
    return products.map(p => ({
      ...p,
      aiDescription: descriptions[p.id] || undefined,
    }))
  } catch (error) {
    console.error('[OpenAI Curator] Unexpected error:', error)
    // Always fall back gracefully
    return products.map(p => ({ ...p }))
  }
}

/**
 * Rank products by relevance for a company (future enhancement)
 *
 * Once we have more training data on which product combinations
 * drive conversions, this can use OpenAI to score product fit
 * based on company size, industry, and budget.
 */
export async function rankProductsByRelevance(
  products: ProductForCuration[],
  companyContext: {
    name: string
    domain: string
    size?: string
    industry?: string
  }
): Promise<CuratedProduct[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return products.map(p => ({
      ...p,
      aiRelevanceScore: 0.5,
    }))
  }

  // TODO: Implement product ranking via OpenAI when needed
  // For now, return unchanged with neutral scores
  return products.map(p => ({
    ...p,
    aiRelevanceScore: 0.5,
  }))
}
