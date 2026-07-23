const trackedProductsKey = "easycart-tracked-products";

export function getTrackedProductIds(): number[] {
    try {
        const value = JSON.parse(
            localStorage.getItem(trackedProductsKey) ?? "[]",
        ) as number[];
        return Array.isArray(value)
            ? value.filter((id) => Number.isInteger(id) && id > 0).slice(0, 100)
            : [];
    } catch {
        return [];
    }
}

export function addTrackedProduct(productId: number) {
    const ids = getTrackedProductIds();
    if (!ids.includes(productId)) {
        localStorage.setItem(
            trackedProductsKey,
            JSON.stringify([productId, ...ids].slice(0, 100)),
        );
        window.dispatchEvent(new Event("easycart-tracked-products-changed"));
    }
}
