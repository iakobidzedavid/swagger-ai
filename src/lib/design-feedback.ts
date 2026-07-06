import { supabase } from '@/lib/supabase'

interface BrandFidelityScore {
  responseCount: number
  brandAccuracyPct: number | null
  reorderRatePct: number | null
}

/**
 * Aggregates real design_feedback rows for a domain into a live Brand Fidelity Score.
 * Shared by the score endpoint (read) and the submit endpoint (returned inline so the
 * widget can show the updated score immediately after a response is recorded).
 */
export async function computeBrandFidelityScore(domain: string): Promise<BrandFidelityScore> {
  const { data, error } = await supabase
    .from('design_feedback')
    .select('brand_accuracy_rating, would_reorder')
    .eq('domain', domain)

  if (error) {
    throw error
  }

  const rows = data || []
  const responseCount = rows.length

  if (responseCount === 0) {
    return { responseCount: 0, brandAccuracyPct: null, reorderRatePct: null }
  }

  const avgRating = rows.reduce((sum, r) => sum + r.brand_accuracy_rating, 0) / responseCount
  const brandAccuracyPct = Math.round((avgRating / 5) * 100)

  const answeredReorder = rows.filter(r => r.would_reorder !== null)
  const reorderRatePct =
    answeredReorder.length === 0
      ? null
      : Math.round((answeredReorder.filter(r => r.would_reorder).length / answeredReorder.length) * 100)

  return { responseCount, brandAccuracyPct, reorderRatePct }
}
