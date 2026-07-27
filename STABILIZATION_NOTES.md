# Stabilization and export notes

## Authentication and request cancellation

- `BuildUserAsync` reads Identity user claims once and role permission claims in one query.
- Admin/staff authentication no longer performs an unnecessary customer lookup. Customer lookup runs only for customer accounts or an explicit customer claim.
- Request-abort cancellation is treated as a disconnected browser, not an API failure.
- A server-side cancellation that is not caused by client disconnect returns HTTP 408 with a retry message.
- Profile authorization data is resolved before `UserManager.UpdateAsync`, so a cancelled follow-up query cannot make a successful save look failed.

## Profile and company settings

- Duplicate email and phone checks exclude the current user and run only when the value changes.
- Company profile/settings responses are mapped from the committed tracked entity; there is no fragile post-save reload.
- The built-in Admin role is accepted by backend policies and frontend permission guards even when a JWT predates newly-added company permissions.
- Company profile, settings, and branches remain separately permission-controlled for non-admin roles.

## Receipts

Available formats:

- A4 PDF
- Continuous 80 mm thermal PDF
- Continuous PNG image
- Browser print/preview

The thermal composition avoids fixed-width total columns, uses relative layout, and scales long monetary values to fit narrow paper. Receipt company data is loaded only from the active single-company row.

## Operational PDF endpoints

```text
GET /api/admin/documents/products/pdf
GET /api/admin/documents/sales/pdf
GET /api/admin/documents/purchases/pdf
GET /api/admin/documents/payroll/pdf
GET /api/admin/documents/expenses/pdf
```

Supported query parameters depend on the document and include `startDate`, `endDate`, `branchId`, `currencyCode`, and `search`.

PDF downloads use a dedicated two-minute frontend timeout without increasing the timeout of normal API requests.

## Financial consistency

Sale item cost is stored at sale time in `OrderItems.UnitCost` and `InventorySaleItems.UnitCost`. This prevents historical profit from changing when later purchases use a different cost.

The startup compatibility repair handles databases where the migration history contains the cost-snapshot migration but the physical `UnitCost` columns are missing.

## Translation coverage

The current Admin UI literal audit covers visible JSX text, common accessible attributes, placeholders, and toast messages. All detected English UI literals have Dari and Pashto entries.

## Local verification

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
