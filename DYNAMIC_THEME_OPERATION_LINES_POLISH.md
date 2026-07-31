# Dynamic Theme and Operation Lines Polish

## Scope

This change is intentionally limited to the requested storefront theme, category hover, recent browser orders, purchase/sale line editor, and admin sidebar translations. Existing order, inventory, product-unit, storefront, and backend behavior is preserved.

## Storefront theme

The storefront no longer applies the configured primary color only to buttons. `storefront-theme.ts` derives a complete semantic palette from the company primary and secondary colors:

- light and dark page backgrounds
- foreground and muted text colors
- cards, popovers, borders, inputs, and focus rings
- secondary/accent surfaces
- dark branded hero/header surfaces
- subtle page glow and readable foreground colors

Invalid or missing colors fall back to the pharmacy palette. Very dark, very light, grayscale, and saturated colors are normalized before use. The browser `theme-color` is also synchronized with the generated brand surface.

The theme remains token-based, so components continue using `bg-background`, `bg-card`, `text-foreground`, `border-border`, and `text-primary` instead of receiving one-off inline colors.

## Purchase and manual-sale lines

The shared `DocumentLines` editor now includes a sticky toolbar inside the scrolling form. It remains visible while staff add or edit many lines on desktop and mobile.

The toolbar shows:

- total number of lines
- ready, empty, and incomplete counts
- combined product-line total
- an always-accessible **Add product** action

Each line header shows its state, selected product, unit, availability, conversion, and line total. Empty rows use a dashed neutral treatment; incomplete rows use a warning treatment; ready rows use the configured primary color.

A newly added line scrolls into view automatically.

### Empty-line rules

A line is considered empty only when it still has the untouched default values and no product, unit, lot number, or expiry date. Empty trailing rows are ignored when saving.

A partially edited row is considered incomplete and blocks submission until it is completed or removed. This prevents entered data from being silently discarded.

## Recent browser orders

Recent orders on the tracking page now use a bounded vertical list with normal mobile scrolling. Every row uses the available width and keeps the order number, date, status, and total readable without horizontal swiping.

## Category navigation

The **Browse categories** trigger now uses the actual company primary color. Active and hovered category rows use a visible primary-tinted background and border in light mode while preserving dark-mode contrast.

## Sidebar translations

Admin navigation now stores typed translation keys instead of translating exact English labels through a fragile lookup table. This fixes labels such as:

- Financial reports
- Company settings
- General types
- Control center

English, Dari, and Pashto direct locale keys remain in parity.

## Validation performed

- TypeScript/TSX syntax parsing for both frontend applications
- local import resolution for both frontend applications
- English, Dari, and Pashto admin locale-key parity
- duplicate translation-key detection
- runtime checks for generated theme tokens
- runtime checks for empty, incomplete, ready, and submittable document lines
- CSS brace validation
- `git diff --check`

A full npm build is not included in this environment because the project dependencies are not installed and the configured React package version is unavailable from the environment registry.

## Manual regression checklist

1. Change the storefront primary and secondary colors in admin settings, reload the web storefront, and check light/dark modes.
2. Open Browse categories in light mode and verify trigger, hover, focus, and selected states.
3. Add at least 10 purchase lines and 10 manual-sale lines; verify the toolbar remains visible and the new row scrolls into view.
4. Leave one untouched blank row and save a valid document; verify the blank row is ignored.
5. Partially edit an extra row and save; verify the form asks for completion rather than discarding it.
6. Open order tracking with several locally stored recent orders and verify vertical scrolling on mobile and desktop.
7. Switch admin language between English, Dari, and Pashto and verify all sidebar groups and items.
