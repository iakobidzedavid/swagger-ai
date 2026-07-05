/**
 * Client-safe favicon URL computation (no Node.js dependencies)
 * Used to generate fallback logo URLs in client components.
 * Uses icon.horse for 64px+ quality logos instead of Google's 16px favicon.
 */

export function getFaviconUrl(domain: string): string {
  return `https://icon.horse/icon/${encodeURIComponent(domain)}`
}
