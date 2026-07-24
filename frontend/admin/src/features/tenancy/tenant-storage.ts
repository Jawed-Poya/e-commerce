export const tenantSlugKey = "easycart-tenant-slug";

function isIpAddress(hostname: string) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function inferredSubdomain(hostname: string) {
    if (hostname === "localhost" || isIpAddress(hostname)) return null;
    const labels = hostname.split(".").filter(Boolean);
    return labels.length > 2 && labels[0] !== "www"
        ? labels[0].toLowerCase()
        : null;
}

export function resolveTenantSlug() {
    const query = new URLSearchParams(window.location.search).get("tenant")?.trim();
    if (query) {
        localStorage.setItem(tenantSlugKey, query.toLowerCase());
        return query.toLowerCase();
    }

    const hostname = window.location.hostname.toLowerCase();
    const stored = localStorage.getItem(tenantSlugKey)?.trim().toLowerCase();
    const legacyIpSlug = isIpAddress(hostname) ? hostname.split(".")[0] : null;
    if (stored && stored !== legacyIpSlug) return stored;
    if (stored && stored === legacyIpSlug) localStorage.removeItem(tenantSlugKey);

    return inferredSubdomain(hostname) ?? "default";
}

export function saveTenantSlug(slug: string) {
    const normalized = slug.trim().toLowerCase() || "default";
    localStorage.setItem(tenantSlugKey, normalized);
    return normalized;
}
