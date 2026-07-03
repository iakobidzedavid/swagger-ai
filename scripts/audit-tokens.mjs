#!/usr/bin/env node
/**
 * Token-conformance audit — scans src/app + src/components for raw hex/rgba
 * color literals that should be design-system CSS variables instead.
 *
 * Formalizes the ad-hoc check done during DE-22 (which only covered /onboard)
 * so it can be re-run against the WHOLE app on every future page.
 *
 * Usage:
 *   node scripts/audit-tokens.mjs            # report only, exits 1 if violations found
 *   node scripts/audit-tokens.mjs --fix       # auto-replaces exact token-value matches with var(--token)
 *   node scripts/audit-tokens.mjs --report-only-exit-0   # never fails the build (for CI advisory mode)
 *
 * Output: writes TOKEN_CONFORMANCE_AUDIT.md at the repo root and prints a summary to stdout.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const GLOBALS_CSS = join(ROOT, 'src/app/globals.css')
const SCAN_DIRS = [join(ROOT, 'src/app'), join(ROOT, 'src/components')]
const SCAN_EXT = new Set(['.tsx', '.ts'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'api']) // api routes have no UI colors
const FIX = process.argv.includes('--fix')
const NEVER_FAIL = process.argv.includes('--report-only-exit-0')

// ---------- 1. Parse tokens from globals.css :root ----------
function parseTokens(cssText) {
  const rootMatch = cssText.match(/:root\s*{([^}]*)}/s)
  if (!rootMatch) return new Map()
  const body = rootMatch[1]
  const tokenRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi
  const hexToVars = new Map() // normalized hex -> [varNames]
  let m
  while ((m = tokenRe.exec(body))) {
    const varName = m[1].trim()
    const value = m[2].trim()
    const hex = normalizeHex(value)
    if (!hex) continue
    if (!hexToVars.has(hex)) hexToVars.set(hex, [])
    hexToVars.get(hex).push(varName)
  }
  return hexToVars
}

function normalizeHex(value) {
  const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (!hexMatch) return null
  let h = hexMatch[1].toLowerCase()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h}`
}

// Prefer the shortest / most "semantic" var name (color-* prefix) when a hex maps to several vars —
// avoids picking a legacy alias like --primary over the canonical --color-accent.
function bestVarFor(vars) {
  const semantic = vars.filter((v) => v.startsWith('color-'))
  const pool = semantic.length ? semantic : vars
  return pool.sort((a, b) => a.length - b.length)[0]
}

// ---------- 2. Walk files ----------
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else if (SCAN_EXT.has(extname(entry))) files.push(full)
  }
  return files
}

// ---------- 3. Scan for hex literals ----------
const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

// Inline suppression, same idea as `eslint-disable-line`: a hex literal on a line
// carrying `audit-allow: <reason>` is a documented, deliberate exception (e.g. a
// literal default value fed to a color-picker input, or example placeholder text)
// rather than a styling decision — it's excluded from the violation count but still
// listed in the report so it stays visible, not silently hidden.
const ALLOW_RE = /audit-allow:\s*(.+?)\s*(?:\*\/|-->)?\s*$/

function scanFile(path, hexToVars) {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  const found = []
  let m
  HEX_RE.lastIndex = 0
  while ((m = HEX_RE.exec(text))) {
    const raw = m[0]
    const norm = normalizeHex(raw)
    const lineNum = text.slice(0, m.index).split('\n').length
    // Check the match's own line AND the line immediately above it — `audit-allow`
    // is valid either as a trailing comment or as its own comment line before the code.
    const sameLine = lines[lineNum - 1] || ''
    const prevLine = lines[lineNum - 2] || ''
    const allowMatch = sameLine.match(ALLOW_RE) || prevLine.match(ALLOW_RE)
    const vars = hexToVars.get(norm) || []
    found.push({
      raw,
      norm,
      line: lineNum,
      matched: vars.length > 0,
      vars,
      allowed: !!allowMatch,
      allowReason: allowMatch ? allowMatch[1] : null,
    })
  }
  return { text, found }
}

function applyFix(text, hexToVars) {
  let fixCount = 0
  // Replace every hex substring match (whole-quoted OR embedded in a longer string like
  // '1px solid #ddd') directly — this only runs against .tsx/.ts source, never globals.css,
  // so it's safe to substitute the color literal in place regardless of surrounding quotes.
  const out = text.replace(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g, (whole) => {
    const norm = normalizeHex(whole)
    const vars = hexToVars.get(norm)
    if (!vars || vars.length === 0) return whole // off-palette — leave for manual review
    fixCount++
    return `var(--${bestVarFor(vars)})`
  })
  return { out, fixCount }
}

// ---------- Run ----------
const cssText = readFileSync(GLOBALS_CSS, 'utf8')
const hexToVars = parseTokens(cssText)

let files = []
for (const dir of SCAN_DIRS) files = walk(dir, files)
files = files.filter((f) => !f.includes(`${join('src', 'app', 'api')}${'/'}`) && !f.includes('/api/'))

const results = []
let totalViolations = 0
let totalMatched = 0
let totalUnmatched = 0
let totalAllowed = 0
const unmatchedHexCounts = new Map()
const allowedEntries = []

for (const file of files) {
  const { text, found } = scanFile(file, hexToVars)
  if (found.length === 0) continue

  let fileText = text
  let fixCount = 0
  if (FIX) {
    const res = applyFix(fileText, hexToVars)
    fileText = res.out
    fixCount = res.fixCount
    if (fixCount > 0) writeFileSync(file, fileText, 'utf8')
  }

  const rel = relative(ROOT, file)
  const active = found.filter((f) => !f.allowed)
  const allowed = found.filter((f) => f.allowed)
  const matched = active.filter((f) => f.matched)
  const unmatched = active.filter((f) => !f.matched)
  totalViolations += active.length
  totalMatched += matched.length
  totalUnmatched += unmatched.length
  totalAllowed += allowed.length
  for (const u of unmatched) {
    unmatchedHexCounts.set(u.norm, (unmatchedHexCounts.get(u.norm) || 0) + 1)
  }
  for (const a of allowed) {
    allowedEntries.push({ file: rel, line: a.line, hex: a.norm, reason: a.allowReason })
  }

  if (active.length > 0) results.push({ file: rel, found: active, fixCount })
}

// ---------- Report ----------
const now = new Date().toISOString().slice(0, 10)
let report = `# Token Conformance Audit\n\n`
report += `**Generated by:** \`scripts/audit-tokens.mjs\`${FIX ? ' (--fix mode)' : ''}\n`
report += `**Scope:** all \`.tsx\`/\`.ts\` files under \`src/app\` + \`src/components\` (excluding \`src/app/**/api/*\` route handlers, which have no UI colors)\n\n`
report += `## Methodology\n\n`
report += `1. Parse every \`--token: #hex;\` declaration out of \`src/app/globals.css\`'s \`:root\` block.\n`
report += `2. Walk every page/component file and regex-match raw hex color literals (\`#fff\`, \`#0d1f33\`, etc.).\n`
report += `3. Classify each literal:\n`
report += `   - **Token match** — the hex value is byte-identical to an existing CSS variable's value. This is drift: the color is *already* on the design system, it's just hardcoded instead of referencing \`var(--token)\`. Auto-fixable.\n`
report += `   - **Off-palette** — the hex value has no corresponding token. Needs either a token added to \`globals.css\` (if it's a legitimate reused/semantic color) or a design decision (if it's a genuine one-off that should be replaced with a system color).\n`
report += `4. \`--fix\` mode replaces every quoted token-match literal with \`var(--token)\`, preferring the shortest \`--color-*\` alias over legacy duplicate variable names.\n`
report += `5. A literal on a line with an \`audit-allow: <reason>\` comment is a documented, deliberate exception (e.g. a color-picker default value or example placeholder text, not a styling decision) — excluded from the violation count but still listed below so it stays visible.\n\n`
report += `## Summary\n\n`
report += `| Metric | Count |\n|---|---|\n`
report += `| Files scanned | ${files.length} |\n`
report += `| Files with raw hex violations | ${results.length} |\n`
report += `| Total hex literal violations | ${totalViolations} |\n`
report += `| — matching an existing token (fixable) | ${totalMatched} |\n`
report += `| — off-palette (needs a token or a decision) | ${totalUnmatched} |\n`
report += `| Documented exceptions (\`audit-allow\`) | ${totalAllowed} |\n\n`

if (unmatchedHexCounts.size > 0) {
  report += `## Off-palette colors still in use\n\n`
  report += `| Hex | Occurrences | Files |\n|---|---|---|\n`
  const byHex = new Map()
  for (const r of results) {
    for (const f of r.found) {
      if (f.matched) continue
      if (!byHex.has(f.norm)) byHex.set(f.norm, new Set())
      byHex.get(f.norm).add(r.file)
    }
  }
  for (const [hex, count] of [...unmatchedHexCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const inFiles = [...(byHex.get(hex) || [])].join(', ')
    report += `| \`${hex}\` | ${count} | ${inFiles} |\n`
  }
  report += `\n`
}

if (results.length > 0) {
  report += `## Per-file detail\n\n`
  report += `| File | Raw hex occurrences | Fixed this run |\n|---|---|---|\n`
  for (const r of results.sort((a, b) => b.found.length - a.found.length)) {
    report += `| \`${r.file}\` | ${r.found.length} | ${FIX ? r.fixCount : '-'} |\n`
  }
  report += `\n`
} else {
  report += `## Per-file detail\n\nNo unresolved violations. Every page conforms to the design-system token set.\n\n`
}

if (allowedEntries.length > 0) {
  report += `## Documented exceptions (\`audit-allow\`)\n\n`
  report += `| File | Line | Hex | Reason |\n|---|---|---|---|\n`
  for (const a of allowedEntries) {
    report += `| \`${a.file}\` | ${a.line} | \`${a.hex}\` | ${a.reason} |\n`
  }
  report += `\n`
}

report += `_Last run: ${now}_\n`

writeFileSync(join(ROOT, 'TOKEN_CONFORMANCE_AUDIT.md'), report, 'utf8')

console.log(`Token audit: ${files.length} files scanned, ${results.length} with raw hex, ${totalViolations} occurrences (${totalMatched} token-matched, ${totalUnmatched} off-palette).`)
if (FIX) {
  const fixed = results.reduce((s, r) => s + r.fixCount, 0)
  console.log(`--fix applied: ${fixed} literal(s) replaced with var(--token).`)
}
console.log(`Report written to TOKEN_CONFORMANCE_AUDIT.md`)

if (!NEVER_FAIL && totalViolations > 0 && !FIX) {
  process.exitCode = 1
}
