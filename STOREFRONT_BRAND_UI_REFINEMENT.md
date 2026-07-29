# Storefront and Brand UI Refinement

## Storefront

- Restored image-first home category cards with category artwork, compact child-category links, and product thumbnails for categories without children.
- Updated the desktop Browse Categories mega menu. Leaf categories now load up to eight products with image, name, and price instead of showing an empty explanation.
- Removed the horizontal navigation scrollbar and made secondary navigation progressively compact on smaller desktop widths.
- Removed customer-tier/general-price wording from product cards while preserving the actual selling price.
- Redesigned old-price presentation with a readable crossed-price badge and discount-saving chip.
- Standardized product media on `object-contain` stages to avoid cropping transparent or white-background images.
- Improved dark-mode border contrast across cards, menus, login, cart inputs, and surfaces.
- Added smoother carousel media, copy, product, and progress animations with reduced-motion support.
- Enabled React Router browser View Transitions for all internal storefront links and programmatic checkout/auth/search navigation.
- Made cart quantity inputs expand according to the maximum/draft quantity while preserving min/max validation.
- Improved account-login borders and surfaces in dark mode.
- Live search now shows directly matching categories plus the categories and parent categories of matching products.

## Admin brand assets

- Company logo and favicon are now selected from the device instead of requiring a manually typed URL.
- Supports drag-and-drop and file chooser workflows.
- Validates image MIME type and a 5 MB limit in both frontend and backend.
- Stores files under `wwwroot/uploads/company/{year}/{month}` using generated safe filenames.
- Supports JPG, PNG, WEBP, and AVIF.
- Relative upload URLs are resolved against the API origin in the Admin sidebar, Admin favicon, upload preview, storefront logo, and storefront favicon.
- Uploaded URLs are placed into the company profile form and applied when the profile is saved.

## API

`POST /api/company/assets/logo`

`POST /api/company/assets/favicon`

Both endpoints require `company.profile.manage`, accept multipart form field `image`, and return the generated public `imageUrl`.

## Verification

Run locally:

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
