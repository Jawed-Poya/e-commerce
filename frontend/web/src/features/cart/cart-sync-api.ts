import { apiGet, apiPut } from '../../shared/api/api-client';

export type SyncedCartItem = {
    productId: number;
    name: string;
    image: string | null;
    price: number;
    stock: number;
    unitId: number | null;
    unitName: string | null;
    quantityStep: number;
    quickOrderQuantities: number[];
    quantity: number;
};

export type SyncedCart = {
    revision: number;
    updatedAt: string | null;
    items: SyncedCartItem[];
};

export const getSyncedCart = () => apiGet<SyncedCart>('/account/cart');

export const updateSyncedCart = (request: {
    baseRevision: number | null;
    merge: boolean;
    items: SyncedCartItem[];
}) => apiPut<SyncedCart>('/account/cart', request);
