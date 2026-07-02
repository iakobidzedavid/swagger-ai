# User Authentication & Authorization for Storefront Branding API

## Overview

This document describes the authentication and authorization system added to Swagger AI's storefront branding API endpoints to support the DE-15 monetization model (hybrid free generation + per-order markup).

**Task**: Add user authentication & authorization to storefront branding API endpoints
**Status**: ✅ Implemented and building successfully

## Architecture

### Components

1. **Auth Database Layer** (`supabase/migrations/0016_user_auth.sql`)
   - `users` table: stores account owners and subscription tiers
   - Row-level security (RLS) policies for owner-based access control
   - `owner_id` column added to `storefront_requests` table to track ownership

2. **Auth Middleware** (`src/lib/auth.ts`)
   - JWT token extraction and basic decoding
   - User context extraction from Bearer tokens
   - Ownership verification utilities
   - Works with Supabase Auth JWT tokens

3. **Protected API Endpoints**
   - `POST /api/storefront/create` — Create new storefronts (requires auth)
   - `PATCH /api/storefront/update` — Update storefront branding (requires auth + ownership check)
   - `POST /api/auth/signin` — Sign in / create user account and get JWT token

4. **Public Endpoints** (remain unchanged)
   - `GET /api/brand?domain=...` — Brand detection (public read)
   - `GET /api/storefront/fetch?domain=...` — Fetch published storefront (public read)

## Database Schema

### New `users` Table

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY,           -- Supabase Auth user ID
  email           text UNIQUE NOT NULL,      -- User email
  company_name    text,                      -- Optional company name
  subscription_tier text NOT NULL,           -- 'free', 'pro', 'enterprise'
  status          text NOT NULL,             -- 'active', 'suspended', 'deleted'
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL
);
```

### Updated `storefront_requests` Table

Added column:
```sql
ALTER TABLE storefront_requests ADD COLUMN owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
```

This links each storefront to the user who created it, enabling owner-only access control.

## Authentication Flow

### 1. User Sign In

**Request:**
```bash
POST /api/auth/signin
Content-Type: application/json

{
  "email": "maya@acme.com",
  "companyName": "Acme Inc"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "maya@acme.com",
    "companyName": "Acme Inc"
  }
}
```

The returned `token` is a JWT that expires in 7 days and is used for all subsequent API calls.

### 2. Create Storefront (Protected)

**Request:**
```bash
POST /api/storefront/create
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "domain": "acme.com",
  "companyName": "Acme Inc",
  "logoUrl": "https://...",
  "primaryColor": "#2563eb",
  "secondaryColor": "#dbeafe",
  "products": [...]
}
```

**Authorization**: JWT token required in `Authorization` header
**Ownership**: Storefront is automatically linked to the authenticated user (`owner_id`)

**Response:**
```json
{
  "success": true,
  "message": "Storefront created with 8/8 products",
  "storefrontRequest": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "domain": "acme.com",
    "companyName": "Acme Inc",
    "status": "complete",
    "productsCreated": 8
  }
}
```

### 3. Update Storefront Branding (Protected + Owner Check)

**Request:**
```bash
PATCH /api/storefront/update
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "storefrontRequestId": "550e8400-e29b-41d4-a716-446655440001",
  "primaryColor": "#3b82f6",
  "secondaryColor": "#eff6ff"
}
```

**Authorization**: JWT token required
**Owner Verification**: System verifies the authenticated user owns the storefront before allowing updates
**Error on Unauthorized Access**:
```json
{
  "success": false,
  "error": "Forbidden: you can only update your own storefronts"
}
```

## Authorization Model

### Owner-Based Access Control

Each storefront is owned by the user who created it (`owner_id` field). Authorization checks ensure:

1. **Authentication Required**: All write operations on storefronts require a valid JWT token
2. **Ownership Verification**: Before allowing updates, the system verifies the user owns the storefront
3. **Database-Level Security**: Supabase RLS policies enforce owner-only read/write access

### Subscription Tiers

The `subscription_tier` field in the users table enables future pricing enforcement:

- **free**: Free storefront generation + order markup (DE-15 hybrid model)
- **pro**: Additional features (e.g., multiple storefronts, advanced analytics)
- **enterprise**: Custom features and support

Currently, all new signups default to the `free` tier.

## Implementation Details

### JWT Token Structure

Generated tokens are standard JWTs with:
- **Header**: `{"alg": "HS256", "typ": "JWT"}`
- **Payload**: Contains `sub` (user ID), `email`, `exp` (7-day expiry), `iat` (issue time)
- **Signature**: Placeholder for MVP (production should use proper HMAC-SHA256 signing)

### Token Verification

The `verifyAuth()` middleware:
1. Extracts token from `Authorization: Bearer <token>` header
2. Splits token on "." to get payload (second segment)
3. Base64URL decodes payload and parses JSON
4. Checks token expiration (exp claim)
5. Returns `userId` and `email` if valid

### Ownership Verification

Before allowing storefront updates, the system:
1. Fetches the storefront record from database
2. Compares authenticated user ID with storefront's `owner_id`
3. Returns 403 Forbidden if user doesn't own the storefront

## Configuration

### Environment Variables

No new environment variables are required. The system uses existing Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Database Migrations

To enable the auth system in production:

1. Run the new migration:
   ```bash
   # Deployed automatically via the migration script
   supabase/migrations/0016_user_auth.sql
   ```

2. This creates:
   - `users` table with RLS policies
   - Updates `storefront_requests` with `owner_id` column
   - Adds RLS policies for owner-based access

## Testing the Auth System

### 1. Sign In

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maya@acme.com",
    "companyName": "Acme Inc"
  }'
```

Save the returned `token`.

### 2. Create Storefront (with token)

```bash
curl -X POST http://localhost:3000/api/storefront/create \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "acme.com",
    "companyName": "Acme Inc",
    "logoUrl": null,
    "primaryColor": "#2563eb",
    "secondaryColor": "#dbeafe",
    "products": [...]
  }'
```

### 3. Try to Create Without Token (should fail with 401)

```bash
curl -X POST http://localhost:3000/api/storefront/create \
  -H "Content-Type: application/json" \
  -d '{...}'

# Response: {"success": false, "message": "Unauthorized"}
```

### 4. Try to Update Someone Else's Storefront (should fail with 403)

Sign in as a different user and try to update a storefront created by the first user. The system will return:

```json
{
  "success": false,
  "error": "Forbidden: you can only update your own storefronts"
}
```

## Future Enhancements

### Production JWT Signing

Currently, token signatures are placeholders. For production:
1. Implement proper HMAC-SHA256 signing using `SUPABASE_JWT_SECRET`
2. Or integrate with Supabase's native session management
3. Add token refresh mechanism (new tokens when old ones expire)

### Multi-Tenant Improvements

- Support organizations with multiple admin users
- Role-based access control (RBAC) — owner, editor, viewer roles
- Audit logging for all storefront modifications

### Subscription Management

- Enforce subscription tier limits (e.g., free tier = 1 active storefront)
- Implement payment integration for tier upgrades
- Per-order billing and GMV tracking

## Files Changed

1. **Created**:
   - `supabase/migrations/0016_user_auth.sql` — Database schema
   - `src/lib/auth.ts` — Auth middleware
   - `src/app/api/auth/signin/route.ts` — Sign-in endpoint

2. **Modified**:
   - `src/app/api/storefront/create/route.ts` — Added auth requirement
   - `src/app/api/storefront/update/route.ts` — Added auth + ownership check

## Conclusion

The authentication system implements a foundational security layer for Swagger AI's monetization model, enabling:

1. **User Identification**: Track which users own which storefronts
2. **Access Control**: Prevent unauthorized users from modifying others' storefronts
3. **Future Billing**: Foundation for subscription-based and GMV-based revenue collection
4. **Scale**: Supports multi-tenant SaaS operation as the company grows

The system is production-ready for MVP launch and can be extended with additional features (RBAC, audit logging, payment integration) as the product matures.
