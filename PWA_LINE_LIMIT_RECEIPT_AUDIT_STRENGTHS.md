# PWA, Operation Limits, Receipts, Permissions, Audit and Product Strengths

This release keeps the existing storefront and administration workflows while closing the offline, receipt, permission, audit and pharmacy-strength gaps.

## 1. Reliable offline PWA shell

The old service worker listed a few static filenames, but a Vite application is built from hashed JavaScript and CSS chunks. When the frontend process stopped, the browser could still have `index.html` while the route chunk for Purchases was missing, so navigation failed.

The new build plugin injects every generated frontend asset into `service-worker.js`. The worker now:

- caches the complete production application shell;
- returns `index.html` for offline navigation requests;
- uses cache-first handling for immutable production assets;
- uses network-first handling for Vite development modules;
- warms the Purchase, Manual Sale, Products and Order route chunks after sign-in;
- never stores authenticated `/api` or SignalR `/hubs` responses in Cache Storage.

Operational lookup data is stored in IndexedDB instead. Products, units, suppliers, customers, recent purchases and recent manual sales are scoped to the signed-in user and branch. Offline purchase and manual-sale writes keep their client request IDs and synchronize when connectivity returns.

### Correct test procedure

A service worker requires `https://` or `localhost`. Browsers do not register it on an ordinary LAN address such as `http://192.168.x.x`.

For a production-like local test:

```bash
cd frontend/admin
npm run pwa:serve
```

1. Open the app online once and sign in.
2. Open Purchase and Manual Sale once so reference data is warmed.
3. In browser DevTools, verify that the service worker is active.
4. Stop the preview server or enable Offline mode.
5. Reload the Purchase route.
6. Create an operation. It should appear in the offline queue.
7. Restore the frontend and API, then synchronize.

The first installation cannot work offline before the browser has downloaded the application shell.

## 2. Configurable purchase and sale line limits

Company settings now expose:

- `MaximumPurchaseLines`
- `MaximumManualSaleLines`

Both accept values from 1 to 500. The UI and API enforce the same policy. The hard limit of 500 protects browser and server resources even for users with override access.

Permissions:

- `operations.line-limits.manage` — change company limits;
- `operations.line-limits.override` — exceed company limits up to 500.

Empty lines are ignored, partially completed lines remain invalid, and only submitted product lines count against the limit.

Selling quantities are no longer blocked by the product's old minimum/maximum metadata. Real stock availability is still enforced.

## 3. A4 and thermal receipt repair

Receipt endpoints accept singular and plural aliases:

```text
GET /api/admin/receipts/orders/{id}/pdf
GET /api/admin/receipts/orders/{id}/pdf?thermal=true
GET /api/admin/receipts/manual-sales/{id}/pdf
GET /api/admin/receipts/manual-sales/{id}/pdf?thermal=true
```

Aliases such as `order`, `sale`, and `manual-sale` are normalized. Legacy records with a null branch are visible to an authorized current branch, and cancelled orders can still be printed as historical documents. JSON errors returned during Blob downloads are now parsed and shown instead of appearing as a generic failed file request.

## 4. Permission completeness

Granular permissions were added for reviews, notifications, general types, storefront content and operation limits. Existing broad permissions continue to grant their historical child capabilities, so current roles do not suddenly lose access.

At startup, `AdminEndpointSecurityValidator` scans every `/api/admin` endpoint and stops the API if an endpoint has no authorization metadata. This prevents a newly added admin controller action from being accidentally public.

Backend and admin frontend permission constants are kept in parity and all permission groups, names and descriptions are translated.

## 5. Complete mutation audit history

Request logs show which endpoint was called. Entity mutation logs now separately capture what changed for business entities and child records, including products, images, prices, unit conversions, inventory, orders, payments, purchases, manual sales, customers, staff, expenses, reviews and storefront content.

For an update, `Changes` stores old and new scalar values. Passwords, security stamps, tokens, tenant/branch infrastructure fields, timestamps and row versions are excluded. The audit queue applies back-pressure and drains during graceful shutdown.

Example:

```json
{
  "Name": { "oldValue": "Paracetamol", "newValue": "Paracetamol Plus" },
  "Strength": { "oldValue": "100 mg", "newValue": "500 mg" }
}
```

## 6. Pharmaceutical strengths and selling units

Strength and selling unit represent different business concepts:

- **Strength:** 100 mg, 250 mg/5 mL, 500 mg, 1%.
- **Selling unit:** tablet, strip, box, bottle, carton.

A 100 mg tablet and a 500 mg tablet must be separate products because they need separate SKU/barcode, price, stock, expiry lots and order history. Each product can then define its own selling-unit conversions, for example:

```text
Paracetamol 500 mg
Base unit: tablet
1 strip = 10 tablets
1 box = 10 strips = 100 tablets
```

Strength is now available in normal product editing, bulk create, bulk update, product search, operation selectors, storefront cards and product details. Order snapshots and manual-sale receipts include it, so historical documents remain understandable even if the catalog changes later.

The existing `ProductVariant` table is not treated as the strength source because variants are not fully connected to inventory lots, selling units, order snapshots and operational transactions in the current architecture.

## 7. Database update

Apply both migrations before starting the updated API:

```bash
dotnet ef database update
```

New migrations:

- `20260731130000_AddOperationLineLimits`
- `20260731140000_AddProductStrength`
