# Admin dashboard, permissions, and real-time storefront alerts

## Admin dashboard

The admin dashboard is available at `/dashboard` and reads from:

```http
GET /api/admin/dashboard
```

It includes:

- total and active products
- total storefront product views
- customers and orders
- pending orders and pending payments
- paid revenue and revenue from the last 30 days
- 30-day order/revenue trend
- order-status distribution
- healthy, low-stock, and out-of-stock inventory counts
- total, reserved, and available stock
- most-viewed products
- top-selling delivered products
- low-stock products
- recent orders
- storefront notification events generated during the last 24 hours
- currently connected storefront SignalR clients

The dashboard requires the `dashboard.view` permission.

## Users, roles, and permission claims

Admin pages:

```text
/system/users
/system/roles
```

Identity role and user claims are used for permissions. No new migration is required because the existing ASP.NET Identity claim tables are reused.

Available permission claims:

```text
dashboard.view
products.view
products.manage
product-pricing.manage
inventory.view
inventory.manage
orders.view
orders.manage
payments.manage
customers.view
customers.manage
users.view
users.manage
roles.manage
system.manage
```

The built-in `Admin` role receives all permissions during application startup. The built-in `Customer` role receives no admin permissions. Custom staff roles can receive any required subset.

Permissions are included in the JWT during login. A user must sign in again after their roles or claims change so the browser receives a refreshed token.

### Example staff roles

Inventory clerk:

```text
inventory.view
inventory.manage
products.view
```

Sales operator:

```text
orders.view
orders.manage
payments.manage
customers.view
```

Catalog manager:

```text
products.view
products.manage
product-pricing.manage
inventory.view
```

## Real-time storefront notifications

The previous implementation stored price/stock events in the database and checked for them every 30 seconds. That was polling, not true real time.

The storefront now connects to:

```text
/hubs/store-notifications
```

using SignalR. The browser subscribes to products that the customer has interacted with, including products opened, added to cart, added to wishlist, or explicitly followed with `Notify me`.

### Events currently delivered

- product price changed for the General/default customer type
- product price changed for the signed-in customer's assigned type
- customer-specific price removed, causing fallback to the default price
- available stock increased
- an order cancellation released reserved stock

### Recipient rules

- Stock events go to connected customers who track that product.
- Default-price events go to connected customers who track that product.
- VIP/Wholesale/custom-type price events go only to connected customers whose resolved customer type matches that price tier.
- Full customer-tier pricing is not broadcast to unrelated customers.

### Reliability behavior

1. The business transaction and notification record are committed to SQL Server.
2. After the commit, SignalR attempts immediate delivery.
3. If SignalR delivery fails, the business action remains successful.
4. The storefront's periodic fallback request retrieves the persisted event later.

This gives immediate delivery when SignalR is available without losing events during a temporary WebSocket/network interruption.

### Important browser limitation

SignalR works while the storefront is open, including a background tab. It does not wake a completely closed browser. Closed-browser notifications require a service worker, Push API subscription storage, VAPID keys, and a server-side Web Push sender.

Browser notification permission and production HTTPS are also required for native desktop browser notifications. In-app notifications still work without browser permission.

## Local verification

1. Start the backend and both frontends.
2. Sign in to the admin again so the new permission claims are present in the JWT.
3. Open a storefront product and click `Notify me`, or add it to cart/wishlist.
4. Keep the storefront open in another window.
5. In admin, increase the product stock or change its applicable price.
6. The notification should appear immediately without waiting for the polling interval.
7. The dashboard's live connection count should show at least one connected storefront client.

```bash
cd backend
dotnet restore
dotnet build
dotnet run
```

```bash
cd frontend/admin
npm install
npm run build
npm run dev
```

```bash
cd frontend/web
npm install
npm run build
npm run dev
```
