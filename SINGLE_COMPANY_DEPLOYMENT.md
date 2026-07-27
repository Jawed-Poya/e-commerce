# Single-company deployment

This repository now runs one company per deployment. The Admin and Web applications no longer use workspace codes, portal keys, tenant headers, custom domains, subscription plans, or company-switching routes.

## Public storefront

Configure the Web application with the API origin and publish it at the desired public domain. The storefront loads its branding and currency configuration from:

```text
GET /api/company/public-profile
```

The public profile is anonymous by design and contains only storefront-safe company fields.

## Admin application

Administrators sign in normally. Company profile, branch, currency, appearance, font, and retention settings are available under **Company Settings**. The built-in `Admin` role is accepted as a full administrator even when an older JWT does not yet contain newly-added permission claims. Other roles still require explicit permission claims.

## Legacy database names

The existing database uses `Tenants`, `TenantSettings`, and `TenantId`. Those names remain only for safe schema compatibility. Runtime company context is fixed to company ID `1`; additional legacy company rows are disabled and cannot be selected by a request.

Do not rename or drop those columns directly on an existing production database. Run the included EF Core migrations first, verify the upgraded data, then schedule any physical schema rename as a separate, tested migration project.

## Deployment checklist

1. Back up the SQL Server database.
2. Configure `ConnectionStrings:DefaultConnection`, JWT values, and CORS origins.
3. Start the API once so `InitializeDatabaseAsync` applies migrations and repairs additive compatibility columns.
4. Build and publish `frontend/admin` and `frontend/web`.
5. Sign out and sign in again after permission changes so the browser receives a fresh JWT.
6. Test company settings, profile updates, A4 receipts, 80 mm thermal receipts, PNG receipts, and operational PDF exports.
