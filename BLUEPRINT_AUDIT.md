# App Blueprint Audit — Session #50 Findings

**Audit Date:** 2026-07-03  
**Repo:** https://github.com/iakobidzedavid/swagger-ai (main branch)  
**Build Status:** ✅ COMPILES (npm run build successful)

---

## Summary

| Status | Count |
|--------|-------|
| ✅ SHIPPED | 7 nodes |
| ⚠️ PARTIAL | 1 node |
| ❌ MISSING | 9 nodes |
| 🔄 DRIFTED | 0 nodes |
| 👻 ORPHANS | 14 routes |

**Total planned:** 24 nodes  
**Progress:** 7/24 fully shipped (29%)

---

## Audit Table: Planned Nodes vs. Reality

| Node | Kind | AUDITED Status | Evidence |
|------|------|---|---|
| planned-app | app | ✅ SHIPPED | `package.json` Next.js app, compiled successfully |
| / | route | ✅ SHIPPED | `src/app/page.tsx` exists, renders homepage with domain input, HomepageBrandPreview component |
| /onboard | route | ✅ SHIPPED | `src/app/onboard/page.tsx` exists, full domain validation + brand fetch UI |
| /products | route | ✅ SHIPPED | `src/app/products/page.tsx` exists, product listing + selection UI |
| /store-created | route | ✅ SHIPPED | `src/app/store-created/page.tsx` exists, confirmation + share links |
| /dashboard | route | ❌ MISSING | No `/dashboard` route; split into `/admin/*` sub-routes (brandfetch, channels, storefront-settings). Dashboard UX not centralized. |
| component:brand-preview | component | ✅ SHIPPED | `src/components/HomepageBrandPreview.tsx` exists, displays brand logo + colors on homepage |
| component:domain-input | component | ✅ SHIPPED | Integrated into HomepageBrandPreview; domain validation + Brandfetch call on homepage |
| component:product-card | component | ❌ MISSING | No dedicated component file; product rendering inlined in `/products` page |
| component:product-customize-modal | component | ❌ MISSING | No modal; product customization not yet implemented |
| component:qr-code-generator | component | ⚠️ PARTIAL | QR code generation exists in `/design-engine/page.tsx` (uses `qrcode` lib), but not exported as reusable component |
| integration:brandfetch | integration | ✅ SHIPPED | `src/lib/brandfetch.ts` exists; called from `/api/brand` + `/api/design/recommendations` |
| integration:printify | integration | ✅ SHIPPED | `src/lib/printify.ts` + `src/lib/printify-catalog.ts` exist; product catalog, create-product, sync endpoints live |
| integration:shopify | integration | ❌ MISSING | No Shopify integration code; backend assumes Printify shop ID; no Shopify storefront API calls |
| integration:google-oauth | integration | ❌ MISSING | No Google OAuth setup; only Printify OAuth in `src/app/api/auth/printify/*` |
| integrations.google_ads | integration | ❌ MISSING | No Google Ads integration |
| integrations.pica | integration | ❌ MISSING | No Pica integration |
| integrations.hyperfx | integration | ❌ MISSING | No HyperFX integration |
| integrations.composio | integration | ❌ MISSING | No Composio integration |
| integrations.zapier | integration | ❌ MISSING | No Zapier integration |

---

## ORPHAN ROUTES (built outside the blueprint plan)

These 14 routes exist in the repo but are not in the planned app_blueprint:

- /checkout, /cart, /design-engine, /preview, /design/recommendations, /pricing, /connect-shop
- /pro-success, /products-created, /order-confirmation
- /admin/brandfetch, /admin/channels, /admin/storefront-settings
- /storefront/[domain]

**Note:** These routes are valuable and actively used. The blueprint was planned conservatively; the team has been shipping pragmatically beyond the plan.

---

## Top 3 Critical Gaps for DE-15 (Monetization)

### 1. **Missing `/dashboard` — Store Management & Analytics** (CRITICAL)
The blueprint calls for a unified `/dashboard` for store management + analytics. Currently missing.
- **Impact:** Maya cannot see GMV, order count, or repeat-order trends for her stores
- **Blocks:** Monetization visibility (DE-15 requires Maya to understand her 15-22% GMV take-rate value)
- **Recommendation:** Create `/dashboard` with storefront list, YTD GMV, order analytics, reorder workflows

### 2. **Missing Shopify Integration** (HIGH)
Blueprint calls for "Shopify Storefront API & Admin API" but code has zero Shopify integration.
- **Impact:** Storefronts are hard-coded to single Printify shop; no per-customer store isolation
- **Blocks:** Fulfillment at scale, real Shopify order management, webhook sync
- **Recommendation:** Implement Shopify Admin API for per-account store creation + order sync

### 3. **Incomplete Component Library** (MEDIUM)
Missing product-card and product-customize-modal components.
- **Impact:** Code duplication, inconsistent styling, harder to iterate
- **Recommendation:** Extract ProductCard and ProductCustomizeModal as reusable components

---

## Build Verification

✅ **npm run build:** SUCCESS  
- All routes compile
- No TypeScript errors
- Next.js build completed successfully

---

