export const productKeys = {
    all: ["products"] as const,

    detail: (id: number) => ["products", id] as const,
};
