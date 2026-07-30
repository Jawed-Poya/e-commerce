# Product units and storefront polish

This refinement keeps the existing repository history and extends the current pharmacy storefront and product administration flows.

## Storefront

- Product-card media is grayscale by default and returns to full color on hover, keyboard focus, or touch/active interaction.
- Removed the duplicated footer promise cards; the homepage service-benefit row remains the single source for secure checkout, delivery, returns, and catalog trust messaging.
- Customer orders no longer use `MinimumValue` or `MaximumValue` as purchase caps. Quantity remains positive and is still limited by actual or display stock.
- Removed customer-facing minimum/maximum quantity warnings from product details and cart rows.

## Product units

- Added a reusable selling-unit editor shared by:
  - single product create/update;
  - bulk product creation;
  - selected-product bulk update.
- Bulk create now sends `UnitConversions[index]` with unit, factor, barcode, price overrides, default state, active state, and sort order.
- Bulk update fetches existing product details first and preserves existing unit conversions instead of accidentally replacing them with an empty list.
- Unit validation covers duplicate units, invalid conversion factors, multiple defaults, inactive defaults, negative unit prices, and invalid old-price relationships.

## Purchase operations

- Purchase receiving quantities do not inherit storefront sale minimum/maximum limits.
- Users can receive any positive decimal quantity in the selected packaging unit.
- Sale operations continue to respect stock availability and configured sale rules.

## Translation

The new selling-unit editor and its validation messages are available in English, Dari, and Pashto. Locale key parity is validated across all three admin resources.

## Validation performed

- Changed TypeScript and TSX files parsed successfully with the TypeScript compiler API.
- English, Dari, and Pashto admin locale keys match exactly.
- `git diff --check` reports no whitespace errors.
- Full frontend dependency builds were not run because the uploaded archive does not include `node_modules` and this environment has no populated npm package cache.
- The .NET SDK is not installed in this environment, so the backend project could not be compiled here.
