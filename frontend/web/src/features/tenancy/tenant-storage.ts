export type StorefrontRouteAccess =
    | { mode: "store"; value: string; basePath: string }
    | { mode: "preview"; value: string; basePath: string }
    | { mode: "default"; value: null; basePath: string };

function segmentAt(index: number) {
    return window.location.pathname.split("/").filter(Boolean)[index] ?? null;
}

export function resolveStorefrontAccess(): StorefrontRouteAccess {
    const mode = segmentAt(0)?.toLowerCase();
    const value = segmentAt(1);
    if (mode === "store" && value && /^[a-z0-9]{24,64}$/i.test(value)) {
        return { mode: "store", value: value.toLowerCase(), basePath: `/store/${value}` };
    }
    if (mode === "preview" && value && value.length >= 40) {
        return { mode: "preview", value, basePath: `/preview/${value}` };
    }
    return { mode: "default", value: null, basePath: "/" };
}

export function storefrontRouterBasename() {
    const basePath = resolveStorefrontAccess().basePath;
    return basePath === "/" ? undefined : basePath;
}
