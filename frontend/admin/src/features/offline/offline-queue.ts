import type { ApiResponse } from "@/api/api-client";
import apiClient from "@/api/api-client";
import { createUuid } from "@/lib/create-uuid";

import { OfflineStores, withOfflineStore } from "./offline-database";
import { getOfflineOwnerKey } from "./offline-owner";

const ChangedEvent = "pharmacy-offline-queue-changed";

export interface PendingMutation {
    id: string;
    url: string;
    body: Record<string, unknown>;
    label: string;
    createdAt: string;
    attempts: number;
    lastError: string | null;
    ownerKey?: string;
}

export type QueueableResponse<T> = ApiResponse<T> & {
    offlineQueued?: boolean;
};

function emitChanged() {
    window.dispatchEvent(new CustomEvent(ChangedEvent));
}

async function addPending(item: PendingMutation) {
    await withOfflineStore(OfflineStores.PendingMutations, "readwrite", (store) => store.put(item));
    emitChanged();
}

async function removePending(id: string) {
    await withOfflineStore(OfflineStores.PendingMutations, "readwrite", (store) => store.delete(id));
    emitChanged();
}

async function updatePending(item: PendingMutation) {
    await withOfflineStore(OfflineStores.PendingMutations, "readwrite", (store) => store.put(item));
    emitChanged();
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
    const ownerKey = getOfflineOwnerKey();
    if (!ownerKey) return [];

    const items = await withOfflineStore<PendingMutation[]>(OfflineStores.PendingMutations, "readonly", (store) =>
        store.getAll(),
    );
    const migrated = items.filter((item) => !item.ownerKey);
    await Promise.all(migrated.map((item) => updatePending({ ...item, ownerKey })));

    return items
        .filter((item) => !item.ownerKey || item.ownerKey === ownerKey)
        .map((item) => item.ownerKey ? item : { ...item, ownerKey })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getPendingMutationCount() {
    return (await getPendingMutations()).length;
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
        : createUuid();
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
        ownerKey: getOfflineOwnerKey() ?? undefined,
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
