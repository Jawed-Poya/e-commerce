# Audit, navigation progress, and offline PWA behavior

## Audit coverage

The admin audit history now has two layers:

1. **Request history** records authenticated API requests such as view, search, create, update, delete, login, logout, approve, reject, import, export, print, restore, archive, activation, synchronization, and assignment.
2. **Entity mutation history** records every added, changed, deleted, or restored `BaseEntity`, except the audit infrastructure tables themselves. Changed fields are stored without passwords, tokens, security stamps, row versions, or other ignored values.

The audit page can filter by action and still search user, entity, route, changed value, or IP address.

## Route progress

Both the admin panel and storefront use a React Router data-navigation progress bar. It starts during lazy route loading, advances without jumping, completes when navigation becomes idle, and respects RTL direction.

## PWA modes

Normal Vite development intentionally removes service workers so source modules never become stale:

```bash
npm run dev
```

Use the explicit PWA development mode only while testing offline behavior:

```bash
npm run dev:pwa
```

For the closest production test, use:

```bash
npm run pwa:serve
```

Open the application while online and wait for the service worker to become **activated and running**. Open the pages/data that must be available offline. Then use DevTools **Application > Service Workers > Offline**, or stop the frontend/API servers and reload the same origin.

A browser cannot open an application offline before that origin has been visited and its service worker has installed successfully.

## Offline strategy

- SPA navigation returns the cached application shell immediately.
- All production chunks are precached by the Vite build plugin.
- Explicit PWA development warms lazy route modules and loaded resources.
- Static assets and images are runtime cached with entry limits.
- Storefront catalog API responses are cached by customer-token scope to avoid mixing guest and signed-in pricing.
- Admin GET responses are cached by administrator-token scope, except authentication endpoints.
- Cached API data is used when the API is stopped or unreachable.
- Supported admin purchase/sale writes remain in the existing IndexedDB queue and synchronize after reconnection.
- An offline banner appears in both applications.
- A network failure no longer removes the storefront customer session; only a real 401/403 response does.
- User-specific API caches are removed during logout.
- Service-worker updates activate automatically and reload once when a newer application version takes control.
