import { OfflineStores, withOfflineStore } from "./offline-database";

interface CachedValue<T> {
    key: string;
    value: T;
    updatedAt: string;
}

export async function readCachedValue<T>(key: string): Promise<T | null> {
    const cached = await withOfflineStore<CachedValue<T> | undefined>(
        OfflineStores.ReferenceCache,
        "readonly",
        (store) => store.get(key),
    );
    return cached?.value ?? null;
}

export async function writeCachedValue<T>(key: string, value: T) {
    const cached: CachedValue<T> = {
        key,
        value,
        updatedAt: new Date().toISOString(),
    };
    await withOfflineStore(OfflineStores.ReferenceCache, "readwrite", (store) => store.put(cached));
}

export async function readReferenceItems<T>(key: string): Promise<T[]> {
    return (await readCachedValue<T[]>(key)) ?? [];
}

export async function mergeReferenceItems<T extends { id: number }>(
    key: string,
    incoming: T[],
) {
    const current = await readReferenceItems<T>(key);
    const merged = new Map(current.map((item) => [item.id, item]));
    incoming.forEach((item) => merged.set(item.id, item));
    await writeCachedValue(key, [...merged.values()]);
}

export function isOfflineNetworkError(error: unknown) {
    return !(error as { response?: unknown })?.response;
}
