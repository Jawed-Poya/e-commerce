# Order idempotency and clean architecture refactor

## Problem fixed

An order can contain the same product more than once when the customer chooses different selling units, for example:

- 2 boxes of a product
- 5 pieces of the same product

The order lines must remain separate for pricing, receipts, and unit display. Inventory, however, is stored in the product's base unit.

The previous delivery implementation created one inventory transaction per order line while using this business key:

```text
order:{orderId}:sale:{productId}
```

Two lines for the same product therefore attempted to insert the same idempotency key. SQL Server correctly rejected the second row through `IX_InventoryTransactions_TenantId_IdempotencyKey`.

## Inventory solution

`OrderInventoryService` now owns all inventory changes caused by an order:

- reservation during checkout
- reservation release during cancellation
- stock commitment during delivery

Before changing inventory, the service groups inventory-affecting order lines by `ProductId` and sums their base-unit quantities. Each order/product/operation combination now produces exactly one inventory transaction:

```text
order:{orderId}:reserve:{productId}
order:{orderId}:release:{productId}
order:{orderId}:sale:{productId}
```

The database unique index remains in place because it is the final protection against repeated or concurrent requests.

### Retry and double-click behavior

The service checks both committed transaction keys and transactions already tracked in the current unit of work. `OrderService.UpdateStatusAsync` also handles database uniqueness and row-version concurrency conflicts:

1. Roll back the failed transaction.
2. Clear stale EF Core tracking state.
3. Reload the committed order.
4. Return success when another request already completed the requested transition.
5. Return a clear conflict message when the operation genuinely needs review.

This makes **Mark as delivered** safe against duplicate clicks and concurrent admin requests.

## Backend organization

### Thin controllers

`OrdersController`, `CheckoutController`, and `FinancialReportsController` now inherit from `ApiControllerBase`. Controllers only handle routing, authorization, request binding, and response shaping.

### Domain services

- `OrderService`: order workflow and application orchestration
- `OrderInventoryService`: base-unit inventory mutations and idempotency
- `FinancialReportService`: financial calculations
- `FinancialDocumentService`: Excel/PDF creation

### Shared API behavior

- `ApiControllerBase` standardizes successful API responses and current-user access.
- `ApiExceptionMiddleware` maps validation, missing records, concurrency conflicts, and database uniqueness conflicts into consistent API responses.
- `SqlServerExceptionClassifier` centralizes SQL Server duplicate-key detection.

A generic repository or generic service base was intentionally not added. EF Core already provides the unit-of-work/repository behavior, and generic business services would hide order and inventory rules instead of simplifying them.

## Admin frontend organization

The affected admin modules now follow a feature-based structure:

```text
features/
  orders/
    components/
    hooks/
    i18n/
    pages/
    order-query-keys.ts
    order-service.ts
    order-types.ts
  finance/
    components/
    hooks/
    i18n/
    pages/
    finance-query-keys.ts
    finance-service.ts
    finance-types.ts
```

Pages compose UI. Hooks own query, filter, mutation, and notification logic. Services own HTTP calls. Components remain presentation-focused.

Additional frontend cleanup includes:

- centralized React Query defaults in `AdminProviders` and web `AppProviders`
- route-level lazy loading for admin pages
- shared API error handling
- shared money formatting
- shared debounced-value hook
- finance-owned types moved out of the company feature
- web translations split into independent locale modules

## Translation cleanup

Order and financial screens now have explicit English, Dari, and Pashto translations. Dates and numbers in the refactored admin screens use the selected language locale:

- English: `en-US`
- Dari: `fa-AF`
- Pashto: `ps-AF`

Translation keys are aligned across all three languages for both admin and storefront applications.

## Database changes

No migration is required for this fix. Do not remove `IX_InventoryTransactions_TenantId_IdempotencyKey`; it is required for safe idempotent inventory processing.

## Regression checklist

1. Create one product with a base unit and at least one selling-unit conversion.
2. Add the same product to an order in two different selling units.
3. Confirm and start processing the order.
4. Click **Mark as delivered** once.
5. Confirm that the order becomes delivered and only one `Sale` inventory transaction exists for that order/product.
6. Repeat the delivery request or double-click the action.
7. Confirm that no duplicate SQL exception is exposed and stock is not deducted twice.
8. Create another order and cancel it.
9. Confirm that reserved stock is released once and availability returns correctly.
10. Verify order and financial pages in English, Dari, and Pashto, including RTL layout and localized dates.

Useful SQL verification:

```sql
SELECT
    TenantId,
    ReferenceId AS OrderId,
    ProductId,
    Type,
    IdempotencyKey,
    Quantity,
    QuantityBefore,
    QuantityAfter,
    ReservedBefore,
    ReservedAfter
FROM dbo.InventoryTransactions
WHERE ReferenceType = 'Order'
  AND ReferenceId = @OrderId
ORDER BY ProductId, Id;
```

## Verification performed in this workspace

- TypeScript/TSX syntax parsing across admin and web source files
- local static-import and dynamic-import resolution
- English/Dari/Pashto translation-key parity
- literal translation-key usage audit
- C# source structure and delimiter checks
- Git whitespace/patch validation
- Git object and history validation before packaging

The workspace does not include the .NET SDK or installed frontend dependencies, so a full `dotnet build`, `npm run build`, and runtime database test must still be run in the normal development environment.
