# Pharmacy Unit Commerce Refactor

## Purpose

Products keep one reliable inventory quantity in a **base unit**, while the storefront and Admin can sell or receive the same product using packaging units such as tablet, capsule, piece (dana), strip, box, bottle, pack, vial, or carton.

Example:

- Product: Paracetamol 500 mg
- Base inventory unit: Tablet
- Strip: 10 tablets
- Box: 10 strips / 100 tablets
- Physical inventory: 2,500 tablets
- Customer availability: 250 strips or 25 boxes

The database still stores `2,500` base tablets. Selecting a box never creates a second stock balance.

On API startup, missing standard pharmacy units are seeded safely: Piece (Dana), Tablet, Capsule, Strip, Box, Bottle, Pack, Vial, Tube, Sachet, and Carton. Existing or soft-deleted matching units are reused instead of duplicated.

## Pricing

Each selling unit may use either:

1. The calculated base price multiplied by its conversion factor, or
2. An explicit package price and optional old price.

Example:

- Base tablet price: $0.10
- Calculated box price for 100 tablets: $10.00
- Optional promotional box price: $9.50
- Optional old box price: $11.00

The selected unit, quantity, factor, name, barcode, and price are snapshotted into each order or operation item. Historical receipts and reports therefore remain correct after a unit setup changes.

## Inventory rules

- Purchases convert the entered package quantity and package cost into base inventory quantity and base unit cost.
- Manual sales convert the selected selling quantity into base inventory quantity before validating and deducting stock.
- Online checkout reserves and deducts base inventory quantities.
- Display-stock products continue to skip physical inventory changes while still validating their configured customer-visible quantity.
- Minimum and maximum quantities remain defined in base units and are converted for the selected selling unit.
- A product and all its selling units must have unique barcodes.
- The base unit must be the smallest tracked unit; each selling-unit factor must be at least 1.
- Duplicate unit configurations are rejected.
- Only one selling unit can be marked as the default.

## Storefront experience

The homepage was rebuilt around a premium, pharmacy-focused commerce workspace inspired by the supplied reference:

- A calm rounded storefront shell
- Dynamic company hero and featured-product carousel
- Image-first pharmacy categories
- Compact popular-category navigation
- Clear product cards and pricing
- Strong light/dark-mode borders
- Support and branch information
- Responsive mobile, tablet, desktop, LTR, and RTL layouts

The product details page lets customers choose the exact selling unit before adding an item to the cart. Different units of the same product can exist as separate cart lines.

## Admin experience

Product create/edit includes:

- Base inventory unit
- Additional selling units
- Conversion factor
- Package barcode
- Optional package price and old price
- Default selling-unit selection
- Active/inactive state and sorting

Purchases and manual sales expose unit-specific selectors and show converted availability, limits, price, and cost.


## Database migration

Apply:

```bash
cd backend
dotnet ef database update
```

Migration:

```text
20260729203000_AddProductUnitConversions
```

Before deployment, back up the SQL Server database.

## Required production checks

```bash
cd backend
dotnet restore
dotnet build
dotnet ef database update

cd ../frontend/web
npm ci
npm run build

cd ../admin
npm ci
npm run build
```

Test at minimum:

1. Receive 5 boxes where one box contains 100 tablets and verify inventory increases by 500 tablets.
2. Sell 2 strips where one strip contains 10 tablets and verify inventory decreases by 20 tablets.
3. Place an online order in boxes and verify reservation, cancellation, and delivery use base quantities.
4. Confirm receipts show the selected package quantity, unit, and package price.
5. Confirm financial reports calculate revenue using selected-unit quantities and prices.
6. Confirm duplicate base/package barcodes are rejected.
7. Confirm display-stock products never change physical inventory.
