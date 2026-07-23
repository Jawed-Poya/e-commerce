# Inventory and Business Operations

This module extends the existing inventory ledger without changing the storefront order workflow.

## Product pricing

The admin product create/edit screen manages the product and all customer-type prices together.

- The default customer type is always required when the user has pricing permission.
- Optional customer types can be enabled or disabled per product.
- Regular price, sale price, and sale date range are supported.
- Product access uses `products.manage`; price changes use `product-pricing.manage`.

## Purchases

`/operations/purchases` contains purchase receipts and supplier management.

Saving a received purchase:

1. Creates a purchase document and item lines.
2. Increases `ProductInventories.Quantity`.
3. Adds an `InventoryTransactions` entry with `ReferenceType = Purchase`.
4. Creates inventory lots in the active warehouse, preserving unit cost, lot number, and expiry.

The complete operation runs in one SQL transaction.

## Manual sales

`/operations/sales` records counter or in-store sales independently from online orders.

Saving a manual sale:

1. Revalidates available stock on the server.
2. Creates a sale document and item lines.
3. Decreases the existing aggregate inventory.
4. Consumes tracked lots using first-expiring-first-out ordering.
5. Adds an `InventoryTransactions` entry with `ReferenceType = ManualSale`.

The storefront checkout and order reservation logic are unchanged.

## Staff and payroll

`/operations/staff` supports:

- Staff profiles and activation status
- Base salary
- Monthly salary payments
- Bonus and deduction calculations
- Payment method and reference history

Archiving a staff member marks the profile inactive so previous salary history remains available.

## Expenses

`/operations/expenses` supports reusable categories and expense records with:

- Date
- Amount
- Vendor/payee
- Payment method
- Reference number
- Description

Default categories are seeded when the database is initialized.

## Permissions

The Admin role receives all permissions automatically. Custom roles can be assigned view and manage permissions separately for operations, purchases, manual sales, staff, payroll, and expenses.

## Database update

From the backend directory, run:

```powershell
dotnet ef database update
```

Migration: `20260723013000_AddInventoryOperations`
