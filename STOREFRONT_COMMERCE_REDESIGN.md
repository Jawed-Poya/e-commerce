# Storefront commerce redesign

## Scope

This update removes the prescription-request workflow and refocuses the public web application on a clear, reusable commerce experience.

## Home page

- Split hero with configurable content and dynamic featured-product slides
- Clean service strip for checkout, delivery, returns, and catalog trust
- Larger image-first category cards
- Full-width featured-product grid
- Dynamic offer spotlight driven by actual catalog pricing
- Company support and branch information
- New-arrivals section and final catalog call to action
- Responsive layout, RTL support, dark mode, and browser view transitions

## Product cards

- Simplified information hierarchy
- Contained product images with alternate-image hover support
- Compact availability and rating states
- Professional current/old price treatment
- Clear add-to-cart and wishlist actions
- Consistent mobile and desktop behavior

## Prescription removal

The public upload form, Admin management page, API controllers, storage service, DTOs, entity mapping, rate-limit policy, and pending migration were removed. Existing databases that already contain the old table may keep it as unused compatibility data; the application no longer reads or writes it.

## Deployment checks

```bash
cd backend
dotnet restore
dotnet build

cd ../frontend/web
npm ci
npm run build

cd ../admin
npm ci
npm run build
```
