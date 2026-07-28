# Production Storefront and Operations Refactor

## Scope

This release unifies the public storefront design, improves catalog discovery, hardens purchase and manual-sale validation, fixes payment-state refresh behavior, and adds a company/branch-scoped Store Operator role.

## Storefront

### Unified visual system

- Reusable product cards use the same spacing, radius, image stage, typography, badges, pricing, and actions across home, catalog, and related sections.
- Product images use a neutral contained stage so transparent or white-background images remain readable in light and dark mode.
- Company currency settings are respected on product, cart, search, home, and filter surfaces.
- Header, mobile navigation, account entry points, search, filters, content sections, and footer use one responsive design language.

### Dynamic home carousel

The home carousel combines:

1. The configured storefront hero content.
2. Up to three active featured products.

It rotates every seven seconds, pauses on hover, supports previous/next controls and indicators, and remains usable when only one slide exists.

### Live global search

- 220 ms debounced search.
- Optional category restriction.
- Product image, category, availability, and configured-currency price preview.
- Matching category shortcuts.
- Keyboard escape, click-outside close, clear, and “view all” behavior.
- Product requests are capped and cached through TanStack Query.

### Category browsing

- Parent categories show compact child-category cards.
- Leaf categories show up to three compact product previews.
- Category preview requests are enabled only for leaf categories and cached for five minutes.

### Dynamic footer

The footer reads company name, legal name, address, phone, email, active branches, and root categories from the public company profile. It no longer contains company-specific hardcoded content.

## Admin transaction integrity

### Duplicate product protection

A product can appear only once in a purchase or manual sale.

- Already-selected products are removed from later selectors.
- React performs an immediate duplicate check.
- ASP.NET Core rejects duplicate IDs even if a client bypasses the UI.
- The backend no longer silently merges duplicate lines.

### Quantity validation

Manual sales validate all of the following in both React and ASP.NET Core:

- Quantity is positive.
- Quantity is at least the product minimum.
- Quantity does not exceed the product maximum.
- Quantity does not exceed current physical or display availability.
- Physical inventory is checked again inside the database transaction before stock is reduced.

Display-stock products are valid for sales but are excluded from purchases because they do not update physical inventory.

### Purchase opening payment

Clicking the purchase total fills the opening payment with the full current total. Discount, tax, other cost, and line changes continue to recalculate the total, and the backend rejects a payment outside zero-to-total.

### Partial-payment state

Purchase, manual-sale, and payroll payment dialogs now:

- Use the updated document returned by the API.
- Update paid amount, remaining amount, and payment status immediately.
- Update matching React Query list caches before refetching.
- Offer a “Pay remaining balance” action.
- Retain row-level database locking and backend remaining-balance validation to prevent overpayment races.

## Store Operator role

The application creates or repairs a built-in company role named `Store Operator` during startup.

The role can work with:

- Dashboard
- Products and pricing
- Inventory
- Orders and payments
- Customers
- Purchases and suppliers
- Manual sales
- Staff and payroll
- Expenses
- Financial reports

It cannot access:

- User accounts
- Role/permission administration
- Company profile/settings
- Branch administration
- Trash administration
- System settings

When the assigned user has a branch, operational lists, records, payments, receipts, financial reports, and document exports are restricted to that branch. Branch create/update operations are always restricted to the active company.

Restart the API after deployment so `InitializeDatabaseAsync` creates or repairs the role. Assign the role and an active branch from the Users page.

## Translation coverage

New storefront content is included in English, Dari, and Pashto. New Admin transaction, validation, stock, payment, role, and branch messages are included in both Dari and Pashto literal dictionaries. Dynamic quantity messages translate the label separately from the numeric value.

## Performance notes

- Live search is debounced and returns at most six product previews.
- Category product previews are bounded to three records and cached for five minutes.
- Main product lists remain paginated.
- Operational list queries remain bounded to 500 recent records.
- Duplicate and quantity checks use one product query per saved document, followed by transactional stock validation.
- Payment updates use row locks to prevent concurrent overpayment.
- Report/document branch scoping is applied before database execution.
- The existing high-volume SQL/PDF benchmark kit remains available in `PERFORMANCE_LOAD_TEST.md`.

## Local production verification

```powershell
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

Then restart the API, assign the `Store Operator` role to a test account with a branch, and verify:

1. The account cannot open Users, Roles, Company, Branches, Trash, or System pages.
2. It cannot request another branch’s operations, reports, receipts, or PDFs directly through the API.
3. Duplicate purchase/sale products are rejected.
4. Sale quantities outside min/max/availability are rejected.
5. Purchase total click fills opening payment.
6. Final partial payments immediately change status to Paid and remaining to zero.
7. Global search, carousel, filters, login, category browsing, footer, and dark mode work on desktop and mobile.
