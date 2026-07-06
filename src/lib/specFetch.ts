// Fetches an API documentation source (OpenAPI/Swagger JSON or YAML, or a
// webhook/UTM config) from a partner-supplied URL, so the acquisition-channel
// integration flow can import a live doc instead of requiring a manual
// copy-paste. This is server-side fetch of a URL an admin user types in, so
// it carries real SSRF risk (a caller could point it at internal/cloud
// metadata addresses) — every request is validated and bounded before any
// network call is made.

const MAX_SPEC_BYTES = 2 * 1024 * 1024 // 2 MB — real OpenAPI docs are well under this
const FETCH_TIMEOUT_MS = 8000

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', 'metadata.google.internal'])

interface FetchOk {
  ok: true
  text: string
  contentType: string | null
  finalUrl: string
}

interface FetchErr {
  ok: false
  error: string
}

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) {return false}
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 127) {return true} // loopback
  if (a === 10) {return true} // 10.0.0.0/8
  if (a === 169 && b === 254) {return true} // link-local / cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) {return true} // 172.16.0.0/12
  if (a === 192 && b === 168) {return true} // 192.168.0.0/16
  if (a === 0) {return true}
  return false
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(h)) {return true}
  if (h.endsWith('.local') || h.endsWith('.internal')) {return true}
  if (isPrivateIPv4(h)) {return true}
  if (h === '[::1]' || h.includes(':')) {return true} // block raw IPv6 literals — not worth the extra validation surface
  return false
}

// Validates that `raw` is a well-formed, public http(s) URL before any
// network call is attempted. Exported so the route (and tests) can surface
// a 4xx without needing to perform the fetch.
function validateSpecUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) {return { ok: false, error: 'spec_url is required' }}

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: `"${trimmed}" is not a valid URL` }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'spec_url must use http or https' }
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: 'spec_url must point to a public, external host' }
  }

  return { ok: true, url }
}

const MAX_REDIRECTS = 5

export async function fetchSpecFromUrl(raw: string): Promise<FetchOk | FetchErr> {
  const validation = validateSpecUrl(raw)
  if (!validation.ok) {return { ok: false, error: validation.error }}

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // Manual redirect handling: each hop is validated *before* it's followed
    // so a public URL can't redirect the request itself into a private/
    // internal address (redirect:'follow' would only let us inspect the
    // final URL after the disallowed request had already been made).
    let currentUrl = validation.url
    let res: Response
    let hops = 0
    for (;;) {
      res = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*' },
      })

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        hops++
        if (hops > MAX_REDIRECTS) {
          return { ok: false, error: 'Too many redirects fetching spec_url' }
        }
        let nextUrl: URL
        try {
          nextUrl = new URL(res.headers.get('location')!, currentUrl)
        } catch {
          return { ok: false, error: 'spec_url redirected to an invalid location' }
        }
        const nextValidation = validateSpecUrl(nextUrl.toString())
        if (!nextValidation.ok) {
          return { ok: false, error: 'spec_url redirected to a disallowed host' }
        }
        currentUrl = nextValidation.url
        continue
      }
      break
    }

    if (!res.ok) {
      return { ok: false, error: `Fetching spec_url returned HTTP ${res.status}` }
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_SPEC_BYTES) {
      return { ok: false, error: `Spec document is too large (>${MAX_SPEC_BYTES / (1024 * 1024)}MB)` }
    }

    // Read with a hard byte cap even when content-length is absent/lied about.
    const reader = res.body?.getReader()
    if (!reader) {
      const text = await res.text()
      if (text.length > MAX_SPEC_BYTES) {
        return { ok: false, error: `Spec document is too large (>${MAX_SPEC_BYTES / (1024 * 1024)}MB)` }
      }
      return { ok: true, text, contentType: res.headers.get('content-type'), finalUrl: res.url }
    }

    let received = 0
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {break}
      if (value) {
        received += value.byteLength
        if (received > MAX_SPEC_BYTES) {
          await reader.cancel()
          return { ok: false, error: `Spec document is too large (>${MAX_SPEC_BYTES / (1024 * 1024)}MB)` }
        }
        chunks.push(value)
      }
    }
    const text = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8')

    return { ok: true, text, contentType: res.headers.get('content-type'), finalUrl: res.url }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: `Timed out fetching spec_url after ${FETCH_TIMEOUT_MS / 1000}s` }
    }
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to fetch spec_url: ${reason}` }
  } finally {
    clearTimeout(timer)
  }
}
