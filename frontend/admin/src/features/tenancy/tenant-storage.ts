export const tenantSlugKey = "easycart-tenant-slug";

export function resolveTenantSlug() {
    const query = new URLSearchParams(window.location.search).get("tenant")?.trim();
    if (query) {
        localStorage.setItem(tenantSlugKey, query.toLowerCase());
        return query.toLowerCase();
    }
    const stored = localStorage.getItem(tenantSlugKey)?.trim();
    if (stored) return stored;
    const labels = window.location.hostname.split(".").filter(Boolean);
    if (labels.length > 2 && labels[0] !== "www") return labels[0].toLowerCase();
    return "default";
}

export function saveTenantSlug(slug: string) {
    const normalized = slug.trim().toLowerCase() || "default";
    localStorage.setItem(tenantSlugKey, normalized);
    return normalized;
}
