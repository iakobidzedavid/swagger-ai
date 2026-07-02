# Brandfetch Integration — Completion Summary

## Overview
The Brandfetch integration provides comprehensive brand data extraction (logos, colors, fonts) for the Swagger AI domain-paste domain → storefront generation flow.

## Architecture

### Core Library (`src/lib/brandfetch.ts`)
- **fetchFromBrandfetch(domain)** — Primary API client
  - Calls Brandfetch v2 API with authentication
  - Extracts logos (SVG-first preference), color palettes, and fonts
  - Returns structured BrandData with source metadata
  - Gracefully returns `null` when API key unavailable or request fails

- **Helper Functions**
  - `extractBestLogo()` — Prioritizes SVG > PNG > fallback
  - `extractColors()` — Validates and normalizes hex colors
  - `extractFonts()` — Extracts font names from Brandfetch data
  - `lightenColor()` — Derives secondary color from primary
  - `deriveCompanyName()` — Extracts company name from domain
  - `isPersonalDomain()` — Filters personal email providers

### API Endpoints

#### GET `/api/brand?domain=<domain>`
**Purpose:** Live brand preview for homepage domain-input widget (real-time as user types)

**Flow:**
1. Check `brand_cache` for fresh (<24h) cached result
2. If cached and fresh → return immediately + bump hit_count
3. Else → fetch live via library's `fetchFromBrandfetch()`
4. If Brandfetch returns data → cache it and return
5. Else → fall back to `fetchKeyless()` (favicon + theme-color meta tag)
6. Always cache the result for next visitor

**Returns:** BrandData with `source` field indicating origin:
- `brandfetch` — Full data from Brandfetch API
- `favicon` — Logo + primary color from Google favicon service
- `theme-color` — Logo from favicon, primary color from HTML meta tag
- `fallback` — Default neutral slate when nothing else works

#### POST `/api/domain/submit`
**Purpose:** Persist domain submission with enriched brand data

**Flow:**
1. Insert initial record with status='fetching'
2. Call library's `fetchFromBrandfetch(domain)`
3. If success → update record with full brand data (colors, fonts, raw metadata)
4. If null → fall back to keyless mode (same as /api/brand)
5. Update status='detected' and persist to `domain_submissions` table

**Stores:** Full brand data including:
- company_name, logo_url, primary_color, secondary_color
- brand_source (brandfetch | favicon | theme-color | fallback)
- color_count, font_count (indexed for analytics)
- raw_brand_data (JSONB): logos[], colors[], fonts[], metadata

### Database Schema

#### `domain_submissions`
```sql
id (uuid)
domain (text, indexed)
company_name (text)
logo_url (text)
primary_color (text)
secondary_color (text)
brand_source (text) -- brandfetch | favicon | theme-color | fallback
color_count (int) -- from Brandfetch palette
font_count (int) -- from Brandfetch data
raw_brand_data (jsonb) -- full response + extraction metadata
status (text) -- pending | fetching | detected | failed
created_at, updated_at (timestamptz)
```

#### `brand_cache`
```sql
domain (text, primary key)
company_name (text)
logo_url (text)
primary_color (text)
secondary_color (text)
brand_source (text)
color_count (int)
font_count (int)
raw_brand_data (jsonb)
hit_count (int) -- incremented on cache hits
fetched_at (timestamptz, indexed)
```

## Features Implemented

### ✓ Brandfetch API Integration
- Authenticated requests to `api.brandfetch.io/v2/brands/{domain}`
- Graceful fallback when BRANDFETCH_API_KEY unavailable
- 8-second timeout to prevent slow requests

### ✓ Logo Extraction
- SVG-first preference (scales best)
- PNG fallback
- Google favicon fallback (keyless mode)

### ✓ Color Extraction
- Full palette support from Brandfetch API (hex validation)
- Primary + secondary color derivation
- Fallback to neutral slate when undetectable

### ✓ Font Extraction
- Fonts from Brandfetch API (up to 5 fonts)
- Stored in raw_brand_data for design engine consumption

### ✓ Caching Layer
- 24-hour TTL for brand_cache entries
- Hit counting for analytics
- Fire-and-forget hit bumps (non-blocking)

### ✓ Keyless Fallback
- Google favicon service (no API key required)
- Theme-color meta tag extraction from HTML
- PNG decoding for color extraction (zlib dependency-free)

### ✓ Consistency
- Unified library use across both API endpoints
- Same brand data structure everywhere
- Consistent source attribution

## Environment Variables

| Variable | Required | Source | Usage |
|----------|----------|--------|-------|
| `BRANDFETCH_API_KEY` | No* | Vercel env vars | Brandfetch API authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel env vars | Supabase brand_cache & domain_submissions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel env vars | Supabase writes (service role) |
| `DATABASE_URL` | Yes (build) | Database | Migration runner on every `npm run build` |

*Optional — fallback to keyless mode if unset

## Testing

### Environment Check
```bash
node test_brandfetch_api.mjs
```

### Build Verification
```bash
npm run build
```

### Local Testing (manual)
1. Start dev server: `npm run dev`
2. Brand preview: `curl "http://localhost:3000/api/brand?domain=linear.app"`
3. Domain submission:
   ```bash
   curl -X POST http://localhost:3000/api/domain/submit \
     -H "Content-Type: application/json" \
     -d '{"domain":"linear.app","contact_email":"test@example.com"}'
   ```

## Data Flow Example

**Scenario:** User types "linear.app" on homepage

1. `/onboard?domain=linear.app` prefill
2. Keystroke handler calls `/api/brand?domain=linear.app`
3. Cache miss → `fetchFromBrandfetch('linear.app')`
4. Brandfetch returns:
   ```json
   {
     "domain": "linear.app",
     "companyName": "Linear",
     "logoUrl": "https://...",
     "primaryColor": "#5e56e6",
     "secondaryColor": "#a9a7f7",
     "source": "brandfetch",
     "colors": ["#5e56e6", "#4c47d5", ...],
     "fonts": ["Inter", "SF Pro Display"],
     "raw": { ... }
   }
   ```
5. Cache written to brand_cache
6. User sees preview with Linear's logo and purple accent
7. User submits domain → POST `/api/domain/submit`
8. Record inserted to domain_submissions with full brand data
9. Storefront generation uses brand data for design engine

## Failure Modes & Recovery

| Failure | Behavior |
|---------|----------|
| BRANDFETCH_API_KEY unset | Use keyless fallback (favicon + theme-color) |
| Brandfetch API timeout (>8s) | Return null, fall back to keyless |
| Brandfetch 401/403 (bad key) | Return null, fall back to keyless |
| Brandfetch 404 (domain not found) | Return null, fall back to keyless |
| Google favicon unreachable | Try theme-color meta tag, use neutral slate |
| Theme-color meta tag absent | Use neutral slate #4b5563 |
| Supabase cache write fails | Continue anyway (cache is perf-only, not critical) |

## Performance Characteristics

- **Cache hit:** ~10ms (Supabase query + JSON serialization)
- **Brandfetch hit:** ~500-2000ms (API call + parsing)
- **Keyless fallback:** ~3-6s (favicon + HTML fetch + color analysis)
- **Cache TTL:** 24 hours (company rebrands slowly)

## Quality Assurance

- ✓ TypeScript strict mode
- ✓ Build passes cleanly
- ✓ BRANDFETCH_API_KEY provisioned
- ✓ Zero duplication (unified library usage)
- ✓ Consistent error handling
- ✓ Database schema ready

## Next Steps (DE-24+)

1. Monitor Brandfetch API quality on real cohort
2. Track brand_source distribution to measure Brandfetch hit rate
3. Potential: Pre-warm cache for popular domains (YC list, top SaaS)
4. Potential: Design engine uses color/font data from Brandfetch
5. Potential: Brand guidelines extraction (CSS vars, font pairings)
