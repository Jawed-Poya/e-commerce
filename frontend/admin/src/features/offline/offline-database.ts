const DatabaseName = "pharmacy-admin-offline";
const DatabaseVersion = 2;

export const OfflineStores = {
    PendingMutations: "pending-mutations",
    ReferenceCache: "reference-cache",
} as const;

export function openOfflineDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DatabaseName, DatabaseVersion);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(OfflineStores.PendingMutations)) {
                database.createObjectStore(OfflineStores.PendingMutations, { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains(OfflineStores.ReferenceCache)) {
                database.createObjectStore(OfflineStores.ReferenceCache, { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("The offline database upgrade is blocked by another open tab."));
    });
}

export async function withOfflineStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const database = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = action(transaction.objectStore(storeName));
        let result: T;

        request.onsuccess = () => {
            result = request.result;
        };
        request.onerror = () => transaction.abort();
        transaction.oncomplete = () => {
            database.close();
            resolve(result);
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error ?? request.error);
        };
        transaction.onabort = () => {
            database.close();
            reject(transaction.error ?? request.error);
        };
    });
}
