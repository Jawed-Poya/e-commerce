export const productKeys = {
    all: ["products"] as const,

    lookups: ["products", "lookups", "hierarchy-v2"] as const,

    detail: (id: number) => ["products", id] as const,
};
