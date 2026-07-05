# App Blueprint Audit — Swagger AI
**Date:** 2026-07-05  
**Live Deploy:** https://swagger-ai-sigma.vercel.app  
**Build Status:** ✅ Successful (63 routes, 0 compilation errors)

---

## AUDIT SUMMARY
**10 SHIPPED · 4 PARTIAL · 0 MISSING · 4 DRIFTED · 20+ ORPHANS**

---

## DETAILED NODE CLASSIFICATION

| Node | Kind | Recorded | **AUDITED** | Evidence |
|------|------|----------|-----------|----------|
| **SHIPPED** |
| / | route | planned | **SHIPPED** | `src/app/page.tsx` exists, builds, returns 200. Displays hero + features + CTA. Links to /onboard functional. |
| /onboard | route | planned | **SHIPPED** | `src/app/onboard/page.tsx` exists, builds, returns 200. DomainInput with validation, brand fetch, real-time error feedback. Normalizes domains, calls `/api/brand` endpoint. |
| /products | route | planned | **SHIPPED** | `src/app/products/page.tsx` exists, builds, returns 200. Fetches brand data, loads 8–12 products from `/api/printify/products`, toggle selection, 4-product minimum enforced. |
| /store-created | route | planned | **SHIPPED** | `src/app/store-created/page.tsx` exists, builds, returns 200. Accepts ?id param, fetches store info via `/api/storefront/fetch`, displays storefront URL and copy-to-clipboard. |
| /dashboard | route | planned | **SHIPPED** | `src/app/dashboard/page.tsx` exists, builds, returns 200. Loads metrics, orders, and storefronts via `/api/dashboard/*` endpoints. Shows order count, revenue, storefront list with brand fidelity. |
| component:domain-input | component | planned | **SHIPPED** | `src/components/DomainInput.tsx` exists, validates format against regex, debounces API validation via `/api/domain/validate`, shows checkmark/error inline, prevents submit if invalid. |
| component:product-card | component | planned | **SHIPPED** | `src/components/ProductCard.tsx` exists, renders product image, name, price, action buttons (toggle selection). Supports selectable/static variants, error handling for broken images. |
| component:brand-preview | component | planned | **SHIPPED** | `src/components/HomepageBrandPreview.tsx` exists. Homepage domain-input widget that calls `/api/brand`, displays read-only logo + colors inline, gates /onboard flow. |
| integration:brandfetch | integration | planned | **SHIPPED** | `src/lib/brandfetch.ts` exists as real API client. Used in `/onboard` flow and `/api/brand` endpoint. Fetches logo + colors via HTTP, caches in Supabase, returns within <3s. |
| integration:printify | integration | planned | **SHIPPED** | `src/lib/printify.ts` + `src/lib/printify-catalog.ts` exist with real PrintifyClient class. Creates shops and products via `/api/printify/*` endpoints. Mock mode if API_KEY absent. |
| **PARTIAL** |
| component:qr-code-generator | component | planned | **PARTIAL** | QR code generation **exists** but **NOT as standalone component**. Hard-coded in `src/app/design-engine/page.tsx` using `qrcode` library. No download-to-PNG button per AC. QR renders in design-engine preview only, not reusable. **Missing:** reusable component + download feature. |
| component:product-customize-modal | component | planned | **PARTIAL** | **NOT FOUND.** Products page (`/products`) allows toggle selection only. No modal to edit product name/description. AC: "Modal opens with pre-filled name/description; Save disables if empty; on Save modal closes and card updates" — **completely unimplemented.** Users cannot customize products. |
| integration:google-oauth | integration | planned | **PARTIAL** | **NOT IMPLEMENTED.** Auth is email-based only (`/api/auth/signin`). Signup/signin workflow accepts email + company name, stores in `users` table, returns JWT. Code comment: "In production, integrate with Supabase Auth's native flow" but no OAuth wired up. AC: "User can sign in via Google OAuth and land on /onboard" — **not met.** |
| integration:shopify | integration | planned | **PARTIAL** | **NOT IMPLEMENTED.** Code comment in `/api/storefront/create`: "In a real implementation, this would be a Shopify store URL." Stores created via Printify only, not Shopify. AC: "Shopify store is created and accessible within 10 seconds" — **not met.** Only Printify integration exists. |
| **MISSING** |
| integrations.google_ads | integration | planned | **MISSING** | No evidence in repo. No imports, no API routes, no lib files. |
| integrations.pica | integration | planned | **MISSING** | No evidence in repo. No imports, no API routes, no lib files. |
| integrations.hyperfx | integration | planned | **MISSING** | No evidence in repo. No imports, no API routes, no lib files. |
| integrations.composio | integration | planned | **MISSING** | No evidence in repo. No imports, no API routes, no lib files. |
| integrations.zapier | integration | planned | **MISSING** | No evidence in repo. No imports, no API routes, no lib files. |

### DRIFTED NODES
(Recorded as planned, but implementation meaningfully diverges from spec)

1. **integration:shopify** — Recorded as "provision a new Shopify store, create products, and sync analytics." Implementation is **Printify-only**; Shopify SDK never called. Storefront URL format: `<domain>.swagger.shop` (Printify namespace), not Shopify URL.

2. **integration:google-oauth** — Recorded as "Authenticate user and retrieve email." Implementation uses **email-only sign-in**, no Google OAuth. JWT token generated manually (not Supabase-native). Session is DB-backed, not OAuth session.

3. **component:qr-code-generator** — Recorded as standalone component with download feature. Implementation is **inline in design-engine page only**, no download-to-PNG.

4. **component:product-customize-modal** — Recorded as modal for editing product name + description. Implementation does **not exist**; product selection is checkbox-only.

---

## ORPHAN ROUTES & COMPONENTS
(Built but not in blueprint — live on deploy)

### User Flows (Not in Blueprint)
- `/connect-shop` — Connect external shop
- `/design-engine` — Design preview with color picker + QR code
- `/design/recommendations` — Brand recommendations page
- `/preview` — Product preview before store creation
- `/cart` — Shopping cart
- `/checkout` — Stripe checkout
- `/order-confirmation` — Order success page
- `/pro-success` — Subscription success page
- `/pricing` — Pricing page
- `/storefront/[domain]` — Storefront homepage (white-label store)
- `/products-created` — Products created success page

### Admin Pages (Not in Blueprint)
- `/admin/brandfetch` — Brandfetch diagnostics
- `/admin/channels` — Channel attribution
- `/admin/printify-diagnostics` — Printify API debugging
- `/admin/printify-diagnostics/product` — Product-level Printify debug
- `/admin/product-generation` — AI product generation admin
- `/admin/storefront-settings` — Storefront branding admin

### API Routes (Not in Blueprint — 40+)
Omitted for brevity. See src/app/api directory for full list.

---

## TOP GAPS (Highest Leverage to Close)

### 1. **Google OAuth Integration [CRITICAL]**
   - **Status:** Planned but unimplemented.
   - **Impact:** Users must create an account via email; no password management, no OAuth UX. Blueprint assumes Google OAuth for frictionless signup.
   - **Evidence:** `/api/auth/signin` is email-only. No Supabase Auth client config. No OAuth callback handler (only Printify OAuth exists at `/api/auth/printify/callback`).
   - **Effort:** 1–2 days. Integrate Supabase Auth with Google provider, update signin flows.
   - **Blocker:** Needed for public launch (credential management risk).

### 2. **Shopify Integration [CRITICAL]**
   - **Status:** Planned but replaced with Printify-only.
   - **Impact:** Blueprint promised "Shopify store creation." Implementation stores products only in Printify. No Shopify Admin API calls, no store URL in Shopify.com domain, no Shopify analytics.
   - **Evidence:** `/api/storefront/create` comment: "In a real implementation, this would be a Shopify store URL." Only `getPrintifyClient()` called.
   - **Effort:** 2–3 days. Add Shopify API client, create shop, add products, sync URLs.
   - **Blocker:** Product fulfillment may differ (Printify print-on-demand vs. Shopify managed inventory).

### 3. **Product Customization Modal [HIGH]**
   - **Status:** Planned but completely missing.
   - **Impact:** Users cannot edit product name/description before store creation. Blueprint AC explicitly requires this feature.
   - **Evidence:** `/products/page.tsx` has no modal component, no product edit form, no character counter.
   - **Effort:** 1 day. Build modal (open on icon click, edit fields, real-time counter, Save/Cancel).
   - **Blocker:** Not launch-critical but reduces user control over branding.

---

## VERDICT
**10 of 17 planned nodes are production-ready.**
- 4 nodes are partially implemented with missing functionality.
- 5 integration nodes are completely missing (Google Ads, Pica, HyperFX, Composio, Zapier).
- **Google OAuth and Shopify are critical gaps.** The app is functional as a Printify print-on-demand front-end with email-based auth.

---

*Report generated by Blueprint Audit skill*
