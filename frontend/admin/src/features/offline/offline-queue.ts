import type { ApiResponse } from "@/api/api-client";
import apiClient from "@/api/api-client";

const DatabaseName = "pharmacy-admin-offline";
const StoreName = "pending-mutations";
const ChangedEvent = "pharmacy-offline-queue-changed";

export interface PendingMutation {
    id: string;
    url: string;
    body: Record<string, unknown>;
    label: string;
    createdAt: string;
    attempts: number;
    lastError: string | null;
}

export type QueueableResponse<T> = ApiResponse<T> & {
    offlineQueued?: boolean;
};

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DatabaseName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(StoreName)) {
                db.createObjectStore(StoreName, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(StoreName, mode);
        const request = action(transaction.objectStore(StoreName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error);
    });
}

function emitChanged() {
    window.dispatchEvent(new CustomEvent(ChangedEvent));
}

async function addPending(item: PendingMutation) {
    await withStore("readwrite", (store) => store.put(item));
    emitChanged();
}

async function removePending(id: string) {
    await withStore("readwrite", (store) => store.delete(id));
    emitChanged();
}

async function updatePending(item: PendingMutation) {
    await withStore("readwrite", (store) => store.put(item));
    emitChanged();
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
    const items = await withStore<PendingMutation[]>("readonly", (store) =>
        store.getAll(),
    );
    return items.sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function getPendingMutationCount() {
    return withStore<number>("readonly", (store) => store.count());
}

export async function discardPendingMutation(id: string) {
    await removePending(id);
}

export function subscribeToOfflineQueue(listener: () => void) {
    window.addEventListener(ChangedEvent, listener);
    return () => window.removeEventListener(ChangedEvent, listener);
}

function requestId(body: Record<string, unknown>) {
    const existing = body.clientRequestId;
    return typeof existing === "string" && existing.trim()
        ? existing
        : crypto.randomUUID();
}

function isNetworkFailure(error: unknown) {
    return !(error as { response?: unknown })?.response;
}

export async function postQueueable<T>(
    url: string,
    body: Record<string, unknown>,
    label: string,
): Promise<QueueableResponse<T>> {
    const id = requestId(body);
    const payload = { ...body, clientRequestId: id };

    if (navigator.onLine) {
        try {
            return await apiClient.post<T>(url, payload);
        } catch (error) {
            if (!isNetworkFailure(error)) throw error;
        }
    }

    await addPending({
        id,
        url,
        body: payload,
        label,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
    });

    return {
        success: true,
        data: null as T,
        message: `${label} was saved on this device and will sync when the connection returns.`,
        offlineQueued: true,
    };
}

export async function syncPendingMutations() {
    if (!navigator.onLine) return { synced: 0, remaining: await getPendingMutationCount() };

    const pending = await getPendingMutations();
    let synced = 0;
    for (const item of pending) {
        try {
            await apiClient.post(item.url, item.body);
            await removePending(item.id);
            synced += 1;
        } catch (error) {
            if (isNetworkFailure(error)) break;
            await updatePending({
                ...item,
                attempts: item.attempts + 1,
                lastError:
                    (error as { response?: { data?: { message?: string } }; message?: string })
                        .response?.data?.message ??
                    (error as Error).message ??
                    "Synchronization failed.",
            });
        }
    }

    return { synced, remaining: await getPendingMutationCount() };
}
