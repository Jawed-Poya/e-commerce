# Display Stock and Storefront Update

## Display-only stock

Products can now use **Display stock** when the company wants to publish an orderable quantity without changing physical inventory.

- Configure it from single-product create/edit, bulk create, or bulk update.
- `DisplayStockQuantity` becomes the storefront availability and per-order upper stock limit.
- Checkout and manual sales still validate product minimum and maximum quantities.
- Orders are created normally and remain available in receipts, customer history, sales reports, and payment workflows.
- Display-stock order items use `AffectsInventory = false`, so fulfillment, cancellation, and reservation-expiry workflows do not reserve, release, or reduce warehouse stock.
- Display-stock products are excluded from inventory health, low-stock warnings, stock reports, and company inventory value.
- If a purchase cost exists, it is snapshotted on the sale item for accurate profit reporting without mutating inventory.

Apply migration:

```bash
cd backend
dotnet ef database update
```

Migration: `20260728120000_AddDisplayStockProducts`

## Editable cart quantity

The storefront cart quantity control accepts typed decimal values. Values are normalized to three decimal places and clamped to the product minimum, maximum, and effective available quantity. Checkout validates the same rules again on the server.

## Storefront design

- `/account/login` now uses the active company logo, company name, configured storefront colors, responsive account tabs, and matching storefront surfaces.
- The featured-catalog product is rendered on a neutral product stage so transparent and white-background product images remain visually consistent with the promotional banner.
