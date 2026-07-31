# Offline operations, audit trails, document references, and PWA branding

## Operation document references

Purchases now keep the supplier bill/invoice number in `Purchases.ReferenceNumber` and manual sales keep an optional external receipt/reference in `InventorySales.ReferenceNumber`.

Admin search supports the internal document number, external reference, supplier/customer, product name, barcode, and purchase lot number. These references are intentionally optional because not every cash transaction has an external bill.

## Safe offline workflow

The admin uses IndexedDB for offline-safe transaction commands. Purchases and manual sales receive a client-generated `ClientRequestId`, and the backend has a filtered unique index per company. This makes synchronization idempotent: reconnects, browser retries, or double clicks cannot create the same transaction twice.

Supported behavior:

- An already-open admin session can save purchases and manual sales without a connection.
- Pending commands are visible from the connection indicator in the admin header.
- Reconnection triggers automatic synchronization; staff can also synchronize manually.
- Invalid server-side commands remain visible with their error and can be discarded deliberately.
- The admin service worker caches only the application shell. It never caches authenticated API responses containing customer, financial, or permission data.
- The storefront service worker caches public company/catalog content and the application shell for safe offline browsing.

Do not queue stock/payment operations on the client unless the backend endpoint also supports an idempotency key. This is why salary payments, expenses, payment verification, and product media uploads remain online-only.

## Dynamic PWA branding

The public company profile controls the browser favicon and installed-app icon. The API serves a dynamic web manifest at:

- `/api/company/manifest.webmanifest` for the storefront
- `/api/company/manifest.webmanifest?app=admin` for the admin application

The favicon is preferred for app icons, with the company logo used as a fallback. A square 512 × 512 favicon produces the best installed-app result. Static manifests/icons remain only as first-load fallbacks.

## Audit and customer-visit logging

### Staff and administrator activity

Authenticated API activity is recorded asynchronously with:

- user ID and display name
- customer ID when applicable
- action category
- controller/entity and route ID when available
- HTTP method, path, response status, and duration
- request ID
- IP address
- browser, operating system, device type, and user agent
- company, branch, and timestamp

Successful admin/customer login and customer registration are recorded explicitly because those requests become authenticated only after the controller completes.

Request bodies, passwords, JWTs, payment details, and uploaded file contents are never stored in audit records.

### Storefront visits

Route visits store session ID, path, referrer, signed-in customer when available, language, screen size, IP, browser, OS, and device type. Repeated visits to the same path in the same session are deduplicated for 15 minutes to avoid analytics noise.

### Reliability and retention

Audit writes use a bounded asynchronous queue with back-pressure and retry the same database batch after transient failures rather than dropping it. Default retention is configured in `appsettings.json`:

```json
"Audit": {
  "ActivityRetentionDays": 365,
  "VisitRetentionDays": 180,
  "CleanupIntervalHours": 12
}
```

Only users with `company.audit-logs.view` can open the Audit & visits page. Administrators retain their role-based bypass.

## Database migrations

Apply these migrations in order:

1. `20260731100000_AddOperationDocumentReferencesAndOfflineIdempotency`
2. `20260731110000_AddAuditAndStoreVisitLogs`

The audit migration keeps the existing `ActivityLogs` table, adds request/device metadata, and creates `CustomerVisitLogs` with company, branch, customer, date, and session indexes.

## Production checks

1. Configure trusted reverse-proxy forwarding so the API receives the real client IP.
2. Use HTTPS for PWA installation, service workers, and IndexedDB reliability outside localhost.
3. Upload a transparent company logo and a square favicon, then save the company profile.
4. Confirm the storefront/admin manifest contains the company name and icon.
5. Create a purchase offline, reconnect, and verify it appears once only.
6. Confirm the Audit & visits page is hidden from users without its permission.
7. Review retention values against company policy and local privacy requirements.
