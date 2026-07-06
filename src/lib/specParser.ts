// Parses the three API specification formats a partner/channel integration
// can be registered with: an OpenAPI/Swagger document, a webhook config, or a
// UTM link-tracking config. Pure functions — no I/O — so they're easy to test.
//
// Real-world OpenAPI/Swagger documents are commonly authored as YAML rather
// than JSON, so the upload flow must accept both — parseSpecSource() is the
// entry point that turns raw uploaded text into a JS value before parseSpec()
// interprets it against the chosen spec_format.

import { parse as parseYaml } from 'yaml'

export type SpecFormat = 'openapi' | 'webhook' | 'utm'
type SourceFormat = 'json' | 'yaml'

interface ParsedEndpoint {
  path: string
  method: string
  summary: string
}

interface ParseResult {
  ok: true
  parsedSummary: string
  parsedEndpoints: ParsedEndpoint[]
  endpointCount: number
}

interface ParseError {
  ok: false
  error: string
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseOpenApi(spec: unknown): ParseResult | ParseError {
  if (!isPlainObject(spec)) {
    return { ok: false, error: 'OpenAPI spec must be a JSON object' }
  }
  const isOpenApiDoc = typeof spec.openapi === 'string' || typeof (spec as { swagger?: unknown }).swagger === 'string'
  const paths = spec.paths
  if (!isOpenApiDoc && !isPlainObject(paths)) {
    return { ok: false, error: 'Not a recognizable OpenAPI/Swagger document — expected an "openapi" or "swagger" version field and a "paths" object' }
  }
  if (!isPlainObject(paths)) {
    return { ok: false, error: 'OpenAPI document is missing a "paths" object' }
  }

  const endpoints: ParsedEndpoint[] = []
  for (const [path, pathItemRaw] of Object.entries(paths)) {
    if (!isPlainObject(pathItemRaw)) continue
    for (const method of HTTP_METHODS) {
      const opRaw = pathItemRaw[method]
      if (!isPlainObject(opRaw)) continue
      const summary = typeof opRaw.summary === 'string'
        ? opRaw.summary
        : typeof opRaw.operationId === 'string'
        ? opRaw.operationId
        : `${method.toUpperCase()} ${path}`
      endpoints.push({ path, method: method.toUpperCase(), summary })
    }
  }

  if (endpoints.length === 0) {
    return { ok: false, error: 'No operations (get/post/put/patch/delete) found under any path' }
  }

  const info = isPlainObject(spec.info) ? spec.info : {}
  const title = typeof info.title === 'string' ? info.title : 'Untitled API'
  const version = typeof info.version === 'string' ? info.version : 'unversioned'
  const pathCount = Object.keys(paths).length

  return {
    ok: true,
    parsedEndpoints: endpoints,
    endpointCount: endpoints.length,
    parsedSummary: `${title} (v${version}) — ${endpoints.length} operation(s) across ${pathCount} path(s)`,
  }
}

function parseWebhook(spec: unknown): ParseResult | ParseError {
  if (!isPlainObject(spec)) {
    return { ok: false, error: 'Webhook config must be a JSON object' }
  }
  const url = spec.url
  if (typeof url !== 'string' || !url.trim()) {
    return { ok: false, error: 'Webhook config requires a "url" string field' }
  }
  try {
    new URL(url)
  } catch {
    return { ok: false, error: `"${url}" is not a valid URL` }
  }
  const method = typeof spec.method === 'string' && spec.method.trim() ? spec.method.toUpperCase() : 'POST'
  const events = Array.isArray(spec.events)
    ? spec.events.filter((e): e is string => typeof e === 'string')
    : []

  return {
    ok: true,
    parsedEndpoints: [{ path: url, method, summary: events.length ? `Triggers on: ${events.join(', ')}` : 'Webhook endpoint' }],
    endpointCount: 1,
    parsedSummary: events.length
      ? `${method} webhook to ${url} for ${events.length} event(s): ${events.join(', ')}`
      : `${method} webhook to ${url}`,
  }
}

function parseUtm(spec: unknown): ParseResult | ParseError {
  if (!isPlainObject(spec)) {
    return { ok: false, error: 'UTM config must be a JSON object' }
  }
  const source = spec.source
  const medium = spec.medium
  const campaign = spec.campaign
  if (typeof source !== 'string' || !source.trim()) {
    return { ok: false, error: 'UTM config requires a non-empty "source" string field' }
  }
  if (typeof medium !== 'string' || !medium.trim()) {
    return { ok: false, error: 'UTM config requires a non-empty "medium" string field' }
  }
  const campaignStr = typeof campaign === 'string' && campaign.trim() ? campaign.trim() : null
  const baseUrl = typeof spec.url === 'string' && spec.url.trim() ? spec.url.trim() : null

  const params = new URLSearchParams({ utm_source: source, utm_medium: medium })
  if (campaignStr) params.set('utm_campaign', campaignStr)
  const trackedPath = baseUrl ? `${baseUrl}?${params.toString()}` : `?${params.toString()}`

  return {
    ok: true,
    parsedEndpoints: [{ path: trackedPath, method: 'GET', summary: 'UTM-tracked acquisition link' }],
    endpointCount: 1,
    parsedSummary: campaignStr
      ? `UTM tracked — source=${source}, medium=${medium}, campaign=${campaignStr}`
      : `UTM tracked — source=${source}, medium=${medium}`,
  }
}

interface SourceParseResult {
  ok: true
  value: unknown
  sourceFormat: SourceFormat
}

interface SourceParseError {
  ok: false
  error: string
}

// Turns raw uploaded/pasted text into a JS value, trying JSON first (the
// common case, and unambiguous when it succeeds) then falling back to YAML
// (which is a superset syntax — most real OpenAPI specs ship this way).
export function parseSpecSource(raw: string): SourceParseResult | SourceParseError {
  const text = raw.trim()
  if (!text) {
    return { ok: false, error: 'Spec text is empty' }
  }

  try {
    return { ok: true, value: JSON.parse(text), sourceFormat: 'json' }
  } catch {
    // fall through to YAML
  }

  try {
    const value = parseYaml(text)
    if (value === undefined) {
      return { ok: false, error: 'Could not parse spec as JSON or YAML' }
    }
    return { ok: true, value, sourceFormat: 'yaml' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Not valid JSON or YAML: ${reason}` }
  }
}

export function parseSpec(format: SpecFormat, spec: unknown): ParseResult | ParseError {
  switch (format) {
    case 'openapi':
      return parseOpenApi(spec)
    case 'webhook':
      return parseWebhook(spec)
    case 'utm':
      return parseUtm(spec)
    default:
      return { ok: false, error: `Unknown spec_format: ${format}` }
  }
}
