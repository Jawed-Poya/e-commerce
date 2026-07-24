# Tenant-to-site routing

Every tenant receives a canonical public storefront URL and a tenant-specific admin URL. Platform administrators configure the global hosts under **Platform → Platform settings**, then choose a routing mode for each company under **Platform → Tenant companies → Edit → Site link**.

## 1. Query link (recommended for localhost and local networks)

Example:

```text
http://192.168.80.38:5174/?tenant=acme
http://192.168.80.38:5173/?tenant=acme
```

This mode needs no DNS changes. The selected tenant is stored for the current hostname, so normal SPA navigation remains connected to the same company.

## 2. Subdomain

Example:

```text
https://acme.example.com
```

Configure:

1. Platform Settings → Root domain: `example.com`
2. Tenant → Site link → Routing mode: `Subdomain`
3. DNS wildcard record: `*.example.com` pointing to the storefront server
4. IIS/reverse-proxy wildcard host binding and TLS certificate

The API resolves a subdomain only when it is under the configured root domain and the tenant is configured for subdomain routing. The configured shared storefront/admin hosts are never mistaken for tenant slugs. The frontend forwards the browser host to a separately hosted API, and the tenant-aware CORS policy permits the configured root domain and its subdomains.

## 3. Custom domain

Example:

```text
https://shop.acme.com
```

Configure:

1. Enable custom domains in Platform Settings.
2. Tenant → Site link → Routing mode: `Custom domain`.
3. Enter `shop.acme.com` without a path.
4. Point the domain DNS to the storefront server.
5. Add the host binding and TLS certificate in IIS/reverse proxy.

A registered custom domain is authoritative and cannot be overridden by a stale browser tenant selection. The storefront sends its browser hostname to the API with `X-Tenant-Host`, so this also works when the storefront and API are hosted on different domains. The API CORS policy automatically allows active registered custom domains and configured tenant subdomains.

## Generated links

The Tenant Companies cards provide **Open** and **Copy** actions for both storefront and admin links. Tenant administrators can also open or copy their storefront from **Company Settings**.

## Subscription limits

Plans define reusable defaults for users, branches, products, monthly orders, storage, prices, currency, and permissions. Tenant creation can override these defaults immediately. The subscription editor can change them later, but user/branch/product/order limits cannot be reduced below current usage.


## Deployment checklist

1. Deploy the same storefront SPA build so it can answer every configured tenant hostname.
2. Set **Platform Settings → Storefront base URL** and **Admin base URL** to the real public deployments.
3. For subdomains, configure the root domain, wildcard DNS, wildcard IIS/reverse-proxy binding, and a compatible TLS certificate.
4. For a custom domain, point DNS to the storefront server and add the IIS/reverse-proxy host binding and TLS certificate.
5. Keep the API URL in `VITE_API_BASE_URL`; the browser sends `X-Tenant-Host` and the API resolves the matching company.
6. Use **Tenant Companies → Open storefront** to verify the generated link.

The dynamic CORS policy refreshes its domain cache shortly after a tenant link or platform routing setting changes, so an API restart is not normally required for a newly registered domain.
