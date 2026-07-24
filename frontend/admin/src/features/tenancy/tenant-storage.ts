export const tenantSlugKey = "easycart-tenant-slug";

export function resolveTenantSlug() {
    return localStorage.getItem(tenantSlugKey)?.trim().toLowerCase() || "default";
}

export function saveTenantSlug(slug: string) {
    const normalized = slug.trim().toLowerCase() || "default";
    localStorage.setItem(tenantSlugKey, normalized);
    return normalized;
}
