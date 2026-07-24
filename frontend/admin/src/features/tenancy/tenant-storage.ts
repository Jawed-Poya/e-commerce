export const tenantSlugKey = "easycart-tenant-slug";
export const tenantHostKey = "easycart-tenant-host";

function isIpAddress(hostname: string) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function rememberTenant(slug: string) {
    const normalized = slug.trim().toLowerCase() || "default";
    localStorage.setItem(tenantSlugKey, normalized);
    localStorage.setItem(tenantHostKey, window.location.hostname.toLowerCase());
    return normalized;
}

export function resolveTenantSlug(): string | null {
    const query = new URLSearchParams(window.location.search).get("tenant")?.trim();
    if (query) return rememberTenant(query);

    const hostname = window.location.hostname.toLowerCase();
    const stored = localStorage.getItem(tenantSlugKey)?.trim().toLowerCase();
    const storedHost = localStorage.getItem(tenantHostKey)?.trim().toLowerCase();
    const legacyIpSlug = isIpAddress(hostname) ? hostname.split(".")[0] : null;

    if (stored && stored === legacyIpSlug) {
        localStorage.removeItem(tenantSlugKey);
        localStorage.removeItem(tenantHostKey);
    } else if (stored && storedHost === hostname) {
        return stored;
    }

    // Localhost and direct LAN IP deployments have no hostname available for
    // tenant discovery. Real domains intentionally omit the header so the API
    // can resolve the registered custom domain or subdomain safely.
    if (hostname === "localhost" || isIpAddress(hostname)) return "default";
    return null;
}

export function saveTenantSlug(slug: string) {
    return rememberTenant(slug);
}
