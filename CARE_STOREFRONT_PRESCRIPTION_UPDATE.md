# Care-focused storefront and prescription workflow

This update redesigns the public storefront around a compact, healthcare-commerce layout while preserving the existing catalog, pricing, inventory, cart, authentication, ordering, dark-mode, multilingual, and company-branding logic.

## Storefront changes

- Dynamic carousel built from the configured storefront hero and featured catalog products.
- Image-first category grid and denser featured-product presentation.
- Company-aware delivery location, account, wishlist, and cart information in the header.
- Trust, delivery, return, support, branch, and health-guidance sections.
- Dynamic company footer with catalog links, account links, active branches, contact details, and prescription support.
- Responsive mobile navigation and dark-mode surfaces.
- Lazy-loaded non-critical catalog images.

No pharmacy-specific brand, doctor profile, payment provider, or delivery promise is hardcoded. The interface uses the company profile, storefront configuration, product catalog, category hierarchy, branches, currency, and existing customer logic.

## Prescription request feature

Customers can submit a private prescription request from the home page with:

- Full name
- Phone number
- Optional email
- Optional notes
- JPG, PNG, WEBP, or PDF attachment up to 8 MB

The backend validates the actual file signature, not only the extension. Files are stored outside `wwwroot` in:

```text
backend/App_Data/prescriptions/YYYY/MM
```

They are not publicly addressable. Authorized Admin users with `Orders.View` can list and download requests. Users with `Orders.Manage` can update the workflow status and internal notes.

Statuses:

```text
Pending
Reviewing
Contacted
Completed
Rejected
```

The public upload endpoint is limited to five requests per IP address in a ten-minute window. Files are deleted automatically if the database operation fails after upload.

## API routes

```http
POST  /api/prescription-requests
GET   /api/admin/prescription-requests
GET   /api/admin/prescription-requests/{id}/attachment
PATCH /api/admin/prescription-requests/{id}/status
```

## Database migration

Apply:

```text
20260729100000_AddPrescriptionRequests
```

Commands:

```bash
cd backend
dotnet ef database update
```

## Deployment notes

- Include `backend/App_Data/prescriptions` in the company backup strategy.
- Give the API process write permission to `backend/App_Data`.
- Do not expose `App_Data` through IIS static-file mappings.
- For a public internet deployment, add antivirus or malware scanning before staff open uploaded files.
- When deployed behind a reverse proxy, configure forwarded headers so IP-based rate limiting receives the real client address.
- Keep `Orders.View` and `Orders.Manage` limited to trusted staff because prescription attachments can contain private information.

## Verification commands

```bash
cd backend
dotnet restore
dotnet build
dotnet ef database update

cd ../frontend/admin
npm ci
npm run build

cd ../web
npm ci
npm run build
```
