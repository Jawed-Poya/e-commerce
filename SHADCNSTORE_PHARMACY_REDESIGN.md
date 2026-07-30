# ShadcnStore Pharmacy Storefront Redesign

## Goal

Refactor the customer-facing pharmacy storefront into a clean, block-based shopping experience inspired by the information hierarchy used by ShadcnStore e-commerce blocks, while keeping the existing API, product, unit-conversion, cart, wishlist, localization, theme, and company configuration behavior.

## Git workflow

The redesign was implemented without replacing or re-initializing the repository:

1. Started from the existing `main` branch and its full `.git` history.
2. Created `feature/shadcnstore-pharmacy-storefront`.
3. Implemented and verified the storefront changes on the feature branch.
4. Committed the feature as one focused conventional commit.
5. Merged the feature branch back into `main` with a non-fast-forward merge so the feature boundary remains visible in the graph.

Useful verification commands:

```bash
git log --graph --oneline --decorate -20
git status
git branch --all
```

## Storefront changes

- Rebuilt the sticky header into three clear levels:
  - secure-shopping and branch/contact strip;
  - company logo, global search, account, wishlist, cart, language, theme, and notifications;
  - dynamic category mega menu and main store navigation.
- Rebuilt the homepage with reusable commerce blocks:
  - dynamic hero carousel;
  - pharmacy unit explanation panel;
  - category cards driven by API data;
  - featured products;
  - dynamic promotion/deal block;
  - newest products;
  - service and trust strip.
- Reworked product cards for faster scanning:
  - calmer card surface and image treatment;
  - category, rating, stock, selling unit, current price, old price, discount, wishlist, details, and add-to-cart actions;
  - responsive two-column mobile catalog and wider desktop grids.
- Simplified the catalog page shell, filter panel, category pills, search toolbar, and result grid.
- Refined the category mega menu and live global-search dropdown to match the new shell.
- Added pharmacy-specific English, Dari, and Pashto storefront copy.
- Updated the default storefront color system to a pharmacy-oriented teal palette while preserving dynamic company color overrides.

## Preserved behavior

- Existing routes and lazy loading.
- Dynamic company logo, favicon, name, branches, contact details, colors, fonts, and language.
- Product and category API queries.
- Product base-unit inventory model and customer-facing selling units.
- Cart quantities, wishlist, order tracking, account, notifications, PWA install, dark mode, and RTL support.

## Validation

The changed TypeScript and TSX files were parsed with the TypeScript compiler API and passed syntax diagnostics. `git diff --check` also passed.

A complete dependency build could not be executed in the artifact environment because the configured package mirror did not contain `react@19.2.7`. Run the normal project verification after extraction in an environment with access to the package versions recorded in `package-lock.json`:

```bash
npm ci
npm run build --workspace frontend/web
```
