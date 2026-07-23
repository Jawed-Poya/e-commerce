# Customer Accounts, Dynamic Pricing, Product Views, Alerts, and Admin Login

This upgrade extends the storefront, admin panel, and ASP.NET Core backend without making customer accounts mandatory.

## Customer experience

### Guest shopping remains supported

A visitor can browse, add products to the cart, and checkout without creating an account.

Anonymous visitors receive the price configured for the default customer type. When `Commerce:DefaultCustomerTypeId` is `null`, the backend chooses a customer type named `General` or `Default`. A `General` customer type is created automatically when one does not exist.

Price resolution always happens on the backend in this order:

1. The signed-in customer's assigned customer-type price.
2. The configured General/default customer-type price.
3. No purchasable price if neither is configured.

The admin pricing dialog requires a default price for every purchasable product. VIP, Wholesale, Staff, or any other customer types remain optional additional tiers.

### Optional account

Storefront routes:

- `/account/login` — customer login and registration.
- `/account` — profile, detected customer type, and order history.

Customers can sign in using email or phone. A new account is assigned the General/default type. If the phone or email already belongs to a guest customer created by checkout, registration claims that existing customer record and preserves its assigned customer type and order history.

Admin can assign or change the type from:

- `/customers` when manually creating a customer.
- `/customers/:id` using **Customer pricing type**.

After the customer signs in again or refreshes their session, the storefront displays the assigned tier price.

## Order number visibility

After checkout, the confirmation page:

- Displays the order number in a dedicated highlighted card.
- Provides a copy button.
- Saves the confirmation in the browser.
- Saves the order in the signed-in customer's account history.
- Links directly to order tracking.

Guest order numbers are also saved in `localStorage` and shown as recent orders on `/track-order`.

## Product view count

The storefront records one view per product per browser session through:

- `POST /api/products/{id}/views`

The updated count is shown on the product page and in the admin product details page. This is intentionally a simple counter. Production analytics can later use a separate event table for unique users, sessions, referrers, and bot filtering.

## Price and restock alerts

The existing `Notifications` table is reused. No database migration is required.

A notification is generated when:

- An effective product price changes for a customer type.
- A customer-specific price is removed and that type falls back to the default price.
- Available inventory increases through an inventory adjustment.
- A cancelled order releases reserved stock.

The storefront follows products that a visitor:

- Opens.
- Adds to cart.
- Adds to wishlist.
- Explicitly follows using **Notify me**.

It polls every 30 seconds while the storefront is open and displays alerts in the notification bell. With browser permission, it also uses the browser Notification API.

Important limitation: this is a browser-tab notification implementation, not true background web push. The storefront must be open in a tab. Notifications normally require HTTPS in production, while localhost is allowed for development. True closed-browser push requires a service worker, Push API subscription storage, and VAPID keys.

Store alert endpoint:

- `GET /api/store/notifications?after=...&productIds=1&productIds=2`

The backend filters price alerts so a customer receives only:

- Their assigned customer-type price changes.
- General/default price changes used as fallback.

Public product responses do not expose the complete VIP/wholesale pricing matrix. Full price tiers are available only to authenticated admin requests.

## Admin authentication

Admin route:

- `/login`

All admin pages are protected by the React `ProtectedRoute`, and backend write/order/customer/inventory/pricing endpoints require the `Admin` role.

Development seed account:

```text
Email: admin@easycart.local
Password: Admin123
```

The seed runs only in the Development environment. Change or remove these values before sharing or deploying the application.

Configuration:

```json
"Jwt": {
  "Issuer": "ECommerce",
  "Audience": "ECommerceClient",
  "Key": "YOUR-VERY-LONG-SECRET-KEY-AT-LEAST-32-CHARACTERS",
  "ExpirationMinutes": 480
},
"SeedAdmin": {
  "Email": "admin@easycart.local",
  "Password": "Admin123",
  "FullName": "EasyCart Administrator"
}
```

For production, set these using environment variables or the deployment secret store:

```text
Jwt__Key
SeedAdmin__Email
SeedAdmin__Password
SeedAdmin__FullName
```

## Authentication endpoints

- `POST /api/auth/customer/register`
- `POST /api/auth/customer/login`
- `POST /api/auth/admin/login`
- `GET /api/auth/me`
- `GET /api/account/orders`
- `GET /api/account/orders/{orderNumber}`

## Local verification

Frontend:

```bash
cd frontend/web
npm ci
npm run build
npm run lint

cd ../admin
npm ci
npm run build
npm run lint
```

Backend:

```bash
cd backend
dotnet restore
dotnet build
dotnet run
```

The backend startup applies existing EF Core migrations, creates the `Admin` and `Customer` roles, ensures a General customer type exists, and seeds the development admin when configured.
