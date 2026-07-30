# Mobile Storefront Refinement

This refinement continues the Shadcn Store pharmacy redesign without replacing or squashing the existing Git history.

## What changed

- Added a dedicated horizontal product-card layout for phone screens while preserving the full desktop card.
- Changed storefront product grids to one card per row on phones and responsive multi-column grids from `sm` upward.
- Rebuilt the home hero as a dark pharmacy commerce banner with clipped media, `overflow-hidden`, slide controls, clear calls to action, and responsive image treatment.
- Replaced the old category tiles with an editorial category grid:
  - the first two categories use large image-led cards;
  - remaining categories use clean information cards with an image area and clear navigation action.
- Added a five-item mobile bottom navigation for Home, Shop, Wishlist, Cart, and Account.
- Improved the mobile call action and kept it above the bottom navigation.
- Rebuilt the footer contact area from the public company profile:
  - company email;
  - company or main-branch phone;
  - company or main-branch address;
  - active branch names.
- Reduced dark-mode border noise by using softer dark border tokens, subtle rings, spacing, and surface contrast instead of repeated hard borders.
- Updated outline buttons globally so dark-mode outlines remain subtle.

## Dynamic company fields

The storefront reads contact information from `GET /company/public-profile` through `CompanyProvider`.

No hard-coded phone, email, address, or branch content was added.

## Main files

- `frontend/web/src/features/home/home-page.tsx`
- `frontend/web/src/features/catalog/product-card.tsx`
- `frontend/web/src/features/catalog/catalog-page.tsx`
- `frontend/web/src/shared/layout/store-layout.tsx`
- `frontend/web/src/shared/components/ui/button.tsx`
- `frontend/web/src/index.css`

## Verification

Completed checks:

- TypeScript/TSX syntax transpilation for all changed files.
- Tailwind CSS candidate compilation for the changed layouts and arbitrary responsive utilities.
- Translation-key validation for all newly used storefront keys.
- `git diff --check` for whitespace and patch errors.

The full `npm ci` / production build cannot run in this environment because the configured package mirror returns `404` for `yallist-3.1.1.tgz`. The source changes themselves are not responsible for that registry failure.
