/**
 * Revenue-engine attribution (DE-18): classify which acquisition channel
 * produced a domain submission, and capture first-touch UTM/referrer data on
 * the client so it can ride along with the /api/domain/submit request.
 *
 * No fabricated channels here — the values this produces are either an
 * explicit ?utm_source= tag a real outbound link carries, or a small set of
 * referrer-derived buckets (organic search, Slack, social, direct) matching
 * the channel taxonomy seeded in supabase/migrations/0003_acquisition_channels.sql
 * and mapped to attribution_key in 0007_channel_attribution.sql.
 */

const MAX_LEN = 100

function clip(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, MAX_LEN)
}

export interface RawAttribution {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  referrer_host?: string | null
}

export interface Attribution extends RawAttribution {
  attribution_key: string
}

/** Server-safe classifier: explicit utm_source wins (it's a deliberate tag on
 * a real link); otherwise fall back to a referrer-host bucket; otherwise
 * 'direct' (typed URL, bookmark, or same-origin navigation with no referrer). */
export function classifyAttribution(raw: RawAttribution): string {
  const src = clip(raw.utm_source)
  if (src) return src.toLowerCase()

  const ref = clip(raw.referrer_host)?.toLowerCase()
  if (!ref) return 'direct'
  if (/(^|\.)google\.|(^|\.)bing\.|(^|\.)duckduckgo\./.test(ref)) return 'organic-search'
  if (/(^|\.)slack\.com$/.test(ref)) return 'peer-slack'
  if (/(^|\.)(linkedin|twitter|x)\.com$/.test(ref)) return 'social'
  return `referral-${ref.replace(/^www\./, '')}`
}

export function sanitizeAttribution(raw: RawAttribution): RawAttribution {
  return {
    utm_source: clip(raw.utm_source),
    utm_medium: clip(raw.utm_medium),
    utm_campaign: clip(raw.utm_campaign),
    referrer_host: clip(raw.referrer_host),
  }
}

const STORAGE_KEY = 'swag_attribution_v1'

/** Capture first-touch attribution once per session. Safe to call on every
 * page — it no-ops once something is already stored. Client-only. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return

    const params = new URLSearchParams(window.location.search)
    const utm_source = params.get('utm_source')
    const utm_medium = params.get('utm_medium')
    const utm_campaign = params.get('utm_campaign')

    let referrer_host: string | null = null
    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer)
        if (refUrl.host !== window.location.host) referrer_host = refUrl.host
      } catch {
        // malformed referrer — ignore
      }
    }

    // Nothing to capture yet (e.g. direct nav with no query) — leave unset so a
    // later page in the same session (with a real referrer/utm) can still capture.
    if (!utm_source && !utm_medium && !utm_campaign && !referrer_host) return

    const payload: RawAttribution = { utm_source, utm_medium, utm_campaign, referrer_host }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable (private mode, etc.) — attribution degrades to 'direct'
  }
}

export function getAttribution(): RawAttribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as RawAttribution
  } catch {
    return {}
  }
}
