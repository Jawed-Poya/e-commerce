# Customers, Orders, and Offline Payments

This implementation connects the customer storefront, admin panel, and ASP.NET Core backend.

## Implemented flow

1. The storefront sends customer/contact details, a shipping address, payment method, product IDs, and quantities.
2. The backend reloads products, resolves the current server-side price, validates purchase limits, and checks stock.
3. The backend creates or updates the customer and default address.
4. The order, items, address snapshot, payment, and status history are created in one database transaction.
5. Product stock is reserved when the order is created.
6. Admin actions control the lifecycle:
   - `Pending -> Confirmed -> Processing -> Delivered`
   - `Pending/Confirmed/Processing -> Cancelled`
7. Cancellation releases reserved stock.
8. Delivery deducts physical quantity and reserved quantity.
9. Cash-on-delivery payment is automatically marked `Paid` when the order is delivered.
10. Bank-transfer orders must be manually marked `Paid` before they can be confirmed.

## Payment methods

### Cash on delivery

- Payment starts as `Pending`.
- Admin confirms and processes the order.
- When admin marks the order `Delivered`, payment becomes `Paid` automatically.

### Manual bank transfer

- The storefront displays configured bank account details.
- The customer enters the transaction/reference number.
- Payment remains `Pending` until an admin verifies it.
- Admin clicks **Verify bank payment**.
- The order can then be confirmed and processed.

## Configure bank details

Update `backend/appsettings.json` and your deployment-specific settings:

```json
"Commerce": {
  "Currency": "USD",
  "FlatShippingFee": 7.5,
  "FreeShippingThreshold": 75,
  "ReservationMinutes": 1440,
  "DefaultCustomerTypeId": null,
  "BankTransfer": {
    "BankName": "Your real bank name",
    "AccountName": "Your business account name",
    "AccountNumber": "Your real account number",
    "Iban": null,
    "Instructions": "Transfer the exact order total and enter the transaction reference."
  }
}
```

For production, place these values in environment variables or server configuration rather than committing real account details.

## Backend endpoints

### Storefront checkout

- `GET /api/checkout/configuration`
- `POST /api/checkout/orders`
- `GET /api/checkout/track?orderNumber=...&phone=...`

### Admin orders

- `GET /api/orders`
- `GET /api/orders/{id}`
- `PATCH /api/orders/{id}/status`
- `PATCH /api/orders/{id}/payment`

### Admin customers

- `GET /api/customers`
- `GET /api/customers/{id}`
- `POST /api/customers`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`

## Frontend routes

### Storefront

- `/cart`
- `/checkout`
- `/orders/:orderNumber/success`
- `/track-order`

### Admin

- `/orders`
- `/orders/:id`
- `/customers`
- `/customers/:id`

## Database

The existing `Customers`, `CustomerAddresses`, `Orders`, `OrderItems`, `Payments`, `OrderStatusHistories`, `ProductInventories`, and `InventoryTransactions` tables are reused. No new migration is required for this version.

## Verification performed

- Storefront: `npm run build` passed.
- Storefront: `npm run lint` passed with existing warnings only.
- Admin: `npm run build` passed.
- Admin: `npm run lint` passed with existing warnings only.
- The current execution environment did not include the .NET SDK, so run the backend validation locally:

```bash
cd backend
dotnet restore
dotnet build
```

Then run the API and verify the full checkout lifecycle against a development database.

## Recommended next production steps

1. Protect `/api/orders` and `/api/customers` with admin authorization.
2. Add an authentication/account flow for customers if order history should be available without phone-based tracking.
3. Add a scheduled job to cancel expired pending reservations.
4. Add bank receipt image upload if a reference number is not sufficient.
5. Add integration tests for concurrent checkout, cancellation, delivery, and duplicate requests.
6. Move shipping calculation into configurable delivery zones when different cities have different fees.
