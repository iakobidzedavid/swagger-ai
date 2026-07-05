/**
 * Client-safe favicon URL computation (no Node.js dependencies)
 * Used to generate fallback logo URLs in client components
 */

export function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
}
