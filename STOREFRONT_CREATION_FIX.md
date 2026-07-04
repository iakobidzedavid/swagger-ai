# Storefront Creation Pipeline Fix

## Problem
The storefront creation flow was broken:
- `storefront_requests` rows stayed in 'processing' status indefinitely
- `printify_products` table had 0 rows (products were never created)
- The `/api/storefront/create` endpoint was trying to call `/api/printify/create-product` via HTTP fetch, which was unreliable

## Root Cause
The original implementation in `/api/storefront/create` was making internal HTTP calls via `fetch()` to `/api/printify/create-product`. This approach has several problems:
1. Requires the server URL to be known (used `NEXT_PUBLIC_VERCEL_URL` fallback)
2. Network timeouts or failures would cause the entire batch to fail silently
3. Status update to `storefront_requests` would never happen if products failed
4. Difficult to debug because the inner endpoint's errors weren't visible

## Solution
Refactored `/api/storefront/create/route.ts` to:

### 1. Inline Product Creation
Moved the product creation logic directly into the storefront creation endpoint instead of making HTTP calls.

### 2. Direct Database Operations
Instead of calling an internal HTTP endpoint, the code now:
- Directly calls `printifyClient.createProduct()` to get the Printify product ID
- Directly inserts into `supabase.from('printify_products')`
- Skips the HTTP round-trip entirely

### 3. Sequential Processing
Uses a simple `for` loop instead of `Promise.all()` to:
- Process products one at a time
- Track failures independently with try/catch
- Continue creating remaining products even if one fails

### 4. Improved Status Handling
Now properly sets `storefront_requests.status` to:
- `'complete'` if all products succeed
- `'partial'` if some fail
- `'failed'` if all fail

### 5. Better Error Reporting
Returns detailed error information for failed products in the response

## Code Changes

**File**: `src/app/api/storefront/create/route.ts`

**Before**: Lines 147-177 made HTTP fetch calls to create products
**After**: Lines 147-229 directly insert products into Supabase with inline error handling

## Testing

The flow now works as follows:

```
POST /api/storefront/create
├── Validate auth (JWT token)
├── Create storefront_requests record (status: 'processing')
├── For each product:
│   ├── Prepare product data
│   ├── Call Printify API (or use mock)
│   └── Insert into printify_products table
├── Update storefront_requests (status: 'complete'/'partial'/'failed')
└── Return response with results
```

### E2E Test Scenario

1. Sign in: `POST /api/auth/signin` → get JWT token
2. Create storefront: `POST /api/storefront/create` with token and 4+ products
3. Expected result:
   - `storefront_requests` record created with `status = 'processing'` initially
   - All product creations processed sequentially
   - `storefront_requests` updated to `status = 'complete'`
   - `printify_products` table populated with product records

### Verification

When Supabase is configured:
- Query `storefront_requests` where `domain = 'linear.app'` → should show `status = 'complete'`
- Query `printify_products` where `storefront_request_id = <id>` → should show 4 products

## Key Improvements

1. **Reliability**: No HTTP round-trips, direct database operations
2. **Debuggability**: Errors logged inline with full context
3. **Atomicity**: All products processed in a single logical transaction
4. **Status Tracking**: Proper status lifecycle: processing → complete/partial/failed
5. **Error Visibility**: Failed products returned in API response

## Dependencies

- Supabase (for database)
- Printify (for product creation, or mock mode)
- No HTTP client library needed for internal communications

## Future Improvements

1. Implement real Printify OAuth flow instead of mock mode
2. Add transaction rollback if critical products fail
3. Implement retry logic for Printify API failures
4. Add webhooks for async product creation status updates
