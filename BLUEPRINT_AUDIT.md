# App Blueprint Audit — Swagger AI
**Date**: 2026-07-02  
**Live Deploy**: https://swagger-ai-sigma.vercel.app  
**Codebase**: Compiles successfully (npm run build ✓)

---

## Summary
**9 shipped · 2 partial · 3 missing · 1 drifted · 5 orphan**

---

## Detailed Audit

| Node Path | Kind | Planned Purpose | Audited Status | Evidence |
|---|---|---|---|---|
| **component:brand-preview** | component | Brand Preview Panel | ✅ SHIPPED | `src/components/HomepageBrandPreview.tsx` — full implementation with logo, color swatches, company name display. Used on both `/` and `/onboard`. |
| **component:qr-code-generator** | component | QR Code Generator | ✅ SHIPPED | `src/app/design-engine/page.tsx` — uses `qrcode` npm package to generate QR for `/api/design-engine/mockup` shareable URLs. |
| **component:product-card** | component | Product Card | ✅ SHIPPED | `src/app/products/page.tsx` — product cards with title, price, variants, category, image, and selection UI. |
| **component:domain-input** | component | Domain Input Field | ✅ SHIPPED | Two implementations: `HomepageBrandPreview.tsx` (homepage widget) and `OnboardForm` in `src/app/onboard/page.tsx`. Both validate domain format & reject personal email providers. |
| **component:product-customize-modal** | component | Product Customization Modal | ⚠️ PARTIAL | `src/app/products/page.tsx` implements product customization (color picker, variant selection), but as **inline page UI, not a modal dialog**. No `<Dialog>` or modal component structure found. The UX exists; the container pattern is missing. |
| **integration:brandfetch** | integration | Brandfetch API | ✅ SHIPPED | `src/app/api/brand/route.ts` — full Brandfetch v2 integration with cache layer, fallback to theme-color scrape & Clearbit logo if BRANDFETCH_API_KEY unset. Tested ✓ 200 HTTP. |
| **integration:printify** | integration | Printify API | ⚠️ PARTIAL | `src/app/api/printify/products/route.ts` exists with **hardcoded mock products**, not real Printify API calls. Routes `/api/printify/products`, `/api/printify/shop`, `/api/printify/create-product` all return mocks. No PRINTIFY_API_KEY integration observed. |
| **integration:google-oauth** | integration | Google OAuth 2.0 | ❌ MISSING | No OAuth flow, no auth middleware, no user login/session. App is guest-only. Zero Google OAuth code found. |
| **integration:shopify** | integration | Shopify Storefront API & Admin API | ❌ MISSING | Only mentioned in comments (`src/app/api/storefront/create/route.ts` line 20: "In a real implementation, this would be a Shopify store URL"). No Shopify SDK, no API calls, no store creation. |
| **/** | route | Landing / Auth | ✅ SHIPPED | `src/app/page.tsx` — landing page with brand preview widget, "Get started" link to `/onboard`, sample mockup link. HTTP 200 ✓. No auth UI (planned "Auth" not implemented). |
| **/onboard** | route | Domain Input & Brand Fetch | ✅ SHIPPED | `src/app/onboard/page.tsx` — full form: domain input, email capture, brand preview fetch, color review, proceed to `/products`. HTTP 200 ✓. |
| **/products** | route | AI-Curated Product Review & Customization | ✅ SHIPPED | `src/app/products/page.tsx` — product grid, variant selection, color customization, mock storefront creation. HTTP 200 ✓. |
| **/design-engine** | route | (Not in planned list; appears in live routes) | ✅ SHIPPED | `src/app/design-engine/page.tsx` — mockup viewer with QR code, product preview, shareable link. HTTP 200 ✓. **DRIFTED**: not in blueprint. |
| **/design/recommendations** | route | (Not in planned list; appears in live routes) | ✅ SHIPPED | `src/app/design/recommendations/page.tsx` — design recommendation UI. HTTP 200 ✓. **DRIFTED**: not in blueprint. |
| **/dashboard** | route | Store Management & Analytics | ❌ MISSING | Route does not exist. HTTP 404 ✓. No `src/app/dashboard/page.tsx` found. |
| **/store-created** | route | Store Provisioning Confirmation & Links | ❌ MISSING | Route does not exist. HTTP 404 ✓. No `src/app/store-created/page.tsx` found. Storefront creation API exists (`/api/storefront/create`) but no confirmation page. |
| **planned-app** | app | Swagger AI | ✅ SHIPPED | Full Next.js app deployed to Vercel. Builds, routes respond, live at https://swagger-ai-sigma.vercel.app. |

---

## Orphan Routes (Not in Blueprint)

| Route | Kind | Evidence | Status |
|---|---|---|---|
| `/admin/brandfetch` | page | `src/app/admin/brandfetch/page.tsx` | Admin utility, built outside plan |
| `/admin/channels` | page | `src/app/admin/channels/page.tsx` | Admin utility, built outside plan |
| `/api/channels` | endpoint | `src/app/api/channels/route.ts` | Built outside plan |
| `/api/channels/spec` | endpoint | `src/app/api/channels/spec/route.ts` | Built outside plan |
| `/api/design/recommendations` | endpoint | `src/app/api/design/recommendations/route.ts` | Built outside plan |
| `/api/design-engine/generate-mockup` | endpoint | `src/app/api/design-engine/generate-mockup/route.ts` | Built outside plan |
| `/api/domain/validate` | endpoint | `src/app/api/domain/validate/route.ts` | Validation helper, built outside plan |
| `/api/domain/submit` | endpoint | `src/app/api/domain/submit/route.ts` | Form submission, built outside plan |
| `/api/storefront/request` | endpoint | `src/app/api/storefront/request/route.ts` | Workflow helper, built outside plan |

**Note**: Many orphan routes are infrastructure / form-handling that supports the planned user flows but were never explicitly listed in the blueprint.

---

## Top Gaps (Highest-Leverage Next Steps)

### 1. **Add `/dashboard` — Store Management & Analytics** (CRITICAL)
   - **Status**: Completely missing; planned node non-existent.
   - **Impact**: Users can create stores but have no place to view them, manage inventory, or see analytics. Revenue engine stalled at onboarding.
   - **Effort**: Medium (need auth session, Supabase query for user's stores, basic card grid + detail view).
   - **Evidence**: HTTP 404; no route file; no Supabase query for `storefront_requests` by user.

### 2. **Add `/store-created` — Storefront Confirmation & Links** (HIGH)
   - **Status**: Completely missing; critical in the flow.
   - **Impact**: `/api/storefront/create` succeeds but user is left on `/products` page. No confirmation, no shareable store URL, no "next steps" guidance.
   - **Effort**: Low-medium (receive storefront_requests ID, fetch record, display URL + copy buttons + share widgets).
   - **Evidence**: HTTP 404; no route file; `/api/storefront/create` returns success but no redirect target.

### 3. **Replace Printify Mocks with Real API** (HIGH)
   - **Status**: `/api/printify/products` returns hardcoded mock catalog; not real Printify integration.
   - **Impact**: Product selection always shows same 8-12 items regardless of brand or intent. No variant pricing from Printify. Mockup images are static. No SKU tracking.
   - **Effort**: Medium (swap mock array for HTTP calls to https://api.printify.com/v1/catalog/products, cache results, handle rate limits).
   - **Evidence**: `src/app/api/printify/products/route.ts` line 28: `const CURATED_PRODUCTS: PrintifyProduct[] = [...]` (hardcoded). No PRINTIFY_API_KEY integration observed.

---

## Blockers & Caveats

- **No Google OAuth**: "Auth" was listed in the planned landing page title but never wired. App runs fully guest-only. Not blocking MVP but needed for store isolation / analytics.
- **No Shopify integration**: Planned but never attempted. Product-creation flow currently uses Printify exclusively (via mock). Shopify would add multi-channel support but is not required for beachhead.
- **Printify mocks**: Users cannot purchase. This is a demo-only product catalog; payment & fulfillment are entirely upstream-blocked.
- **No email delivery**: Storefront confirmation (when built) will not auto-email the user; they must copy the URL manually or use social share buttons.

---

## Live Spot-Check Results

| Route | Expected | Actual | Status |
|---|---|---|---|
| `https://swagger-ai-sigma.vercel.app/` | 200 | 200 | ✓ LIVE |
| `https://swagger-ai-sigma.vercel.app/onboard` | 200 | 200 | ✓ LIVE |
| `https://swagger-ai-sigma.vercel.app/products` | 200 | 200 | ✓ LIVE |
| `https://swagger-ai-sigma.vercel.app/dashboard` | 200 | 404 | ✗ MISSING |
| `https://swagger-ai-sigma.vercel.app/store-created` | 200 | 404 | ✗ MISSING |

---

## Conclusion

**Core PLG funnel is 80% shipped.** Visitors can land, preview their brand, onboard with domain/email, review products, and submit a store request. Printify product catalog is mocked but functional. The two critical gaps are:
1. No confirmation page after store creation.
2. No dashboard to view created stores.

These two pages would unlock the closing loop: users see proof their store exists and get a shareable link. Currently the experience stops mid-flow. **Recommend prioritizing `/store-created` + `/dashboard` before any OAuth or Shopify work.**
