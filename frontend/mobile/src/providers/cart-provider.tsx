import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/lib/api';
import { getApiOrigin } from '@/lib/runtime-config';
import { commerceApi } from '@/lib/commerce-api';
import { getToken, storageKeys } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import type { Product, SyncedCart, SyncedCartItem } from '@/types/domain';

export type CartItem = {
  lineKey: string;
  id: number;
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

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  syncStatus: 'local' | 'syncing' | 'synced' | 'offline';
  lastSyncedAt: string | null;
  addProduct: (product: Product, quantity?: number) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function roundCartQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function cartQuantityStep(item: { quantityStep?: number; orderQuantityStep?: number }) {
  const value = item.quantityStep ?? item.orderQuantityStep;
  return Number.isFinite(value) && Number(value) > 0 ? roundCartQuantity(Number(value)) : 1;
}

export function maximumCartQuantity(item: Pick<CartItem, 'stock' | 'quantityStep'>) {
  const step = cartQuantityStep(item);
  return roundCartQuantity(Math.floor((Math.max(0, item.stock) + Number.EPSILON) / step) * step);
}

export function normalizeCartQuantity(item: Pick<CartItem, 'stock' | 'quantityStep'>, quantity: number) {
  const step = cartQuantityStep(item);
  const maximum = maximumCartQuantity(item);
  if (maximum < step) return 0;
  if (!Number.isFinite(quantity)) return step;
  if (quantity <= 0) return 0;
  const bounded = Math.min(maximum, Math.max(step, quantity));
  const stepped = Math.floor((bounded + Number.EPSILON) / step) * step;
  return roundCartQuantity(Math.max(step, stepped));
}

export function cartQuickQuantities(
  item: Pick<CartItem, 'stock' | 'quantityStep'>,
  configured: number[] | null | undefined,
) {
  const step = cartQuantityStep(item);
  const maximum = maximumCartQuantity(item);
  return [...new Set((configured ?? [])
    .map(Number)
    .filter((quantity) =>
      Number.isFinite(quantity) &&
      quantity > 0 &&
      quantity <= maximum + Number.EPSILON &&
      Math.abs(quantity / step - Math.round(quantity / step)) < 1e-9)
    .map(roundCartQuantity))]
    .sort((left, right) => left - right);
}

export function CartProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CartContextValue['syncStatus']>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const itemsRef = useRef<CartItem[]>([]);
  const ownerRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const syncedFingerprintRef = useRef('');
  const syncBusyRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const cartEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestCartSync = useCallback(() => {
    syncQueuedRef.current = true;
    setSyncAttempt((current) => current + 1);
  }, []);

  const finishCartSync = useCallback(() => {
    syncBusyRef.current = false;
    if (!syncQueuedRef.current) return;
    syncQueuedRef.current = false;
    setSyncAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(storageKeys.cart)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value) as CartItem[];
        setItems(parsed.map((item) => ({
          ...item,
          unitId: item.unitId ?? null,
          unitName: item.unitName ?? null,
          quantityStep: cartQuantityStep(item),
          quickOrderQuantities: Array.isArray(item.quickOrderQuantities) ? item.quickOrderQuantities : [],
          quantity: normalizeCartQuantity(item, item.quantity),
        })).filter((item) => item.quantity > 0));
      })
      .catch(() => setItems([]))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(storageKeys.cart, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!hydrated || auth.loading) return;
    const customerId = auth.user?.customerId ?? null;
    if (!customerId) {
      ownerRef.current = null;
      revisionRef.current = 0;
      syncedFingerprintRef.current = '';
      syncQueuedRef.current = false;
      setSyncStatus('local');
      setLastSyncedAt(null);
      return;
    }
    if (ownerRef.current === customerId) return;
    if (syncBusyRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    let active = true;
    syncQueuedRef.current = false;
    syncBusyRef.current = true;
    setSyncStatus('syncing');
    void commerceApi.cart()
      .then(async (remote) => {
        const serverItems = fromSyncedCart(remote);
        const merged = mergeCartItems(serverItems, itemsRef.current);
        const resolved = cartFingerprint(merged) === cartFingerprint(serverItems)
          ? remote
          : await commerceApi.updateCart({
            baseRevision: remote.revision,
            merge: true,
            items: toSyncedItems(merged),
          });
        if (!active) return;
        const resolvedItems = fromSyncedCart(resolved);
        ownerRef.current = customerId;
        revisionRef.current = resolved.revision;
        syncedFingerprintRef.current = cartFingerprint(resolvedItems);
        setItems(resolvedItems);
        setLastSyncedAt(resolved.updatedAt);
        setSyncStatus('synced');
      })
      .catch(() => {
        if (!active) return;
        setSyncStatus('offline');
      })
      .finally(finishCartSync);

    return () => { active = false; };
  }, [auth.loading, auth.user?.customerId, finishCartSync, hydrated, syncAttempt]);

  useEffect(() => {
    const customerId = auth.user?.customerId ?? null;
    if (!hydrated || !customerId || ownerRef.current !== customerId) return;
    if (syncBusyRef.current) {
      syncQueuedRef.current = true;
      return;
    }
    const targetFingerprint = cartFingerprint(items);
    if (targetFingerprint === syncedFingerprintRef.current) return;

    const timer = setTimeout(() => {
      if (syncBusyRef.current) {
        syncQueuedRef.current = true;
        return;
      }
      const target = itemsRef.current;
      const fingerprint = cartFingerprint(target);
      syncBusyRef.current = true;
      setSyncStatus('syncing');

      const push = async () => {
        try {
          return await commerceApi.updateCart({
            baseRevision: revisionRef.current,
            merge: false,
            items: toSyncedItems(target),
          });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
          const latest = await commerceApi.cart();
          revisionRef.current = latest.revision;
          return commerceApi.updateCart({
            baseRevision: latest.revision,
            merge: false,
            items: toSyncedItems(target),
          });
        }
      };

      void push()
        .then((response) => {
          revisionRef.current = response.revision;
          syncedFingerprintRef.current = fingerprint;
          setLastSyncedAt(response.updatedAt);
          setSyncStatus(cartFingerprint(itemsRef.current) === fingerprint ? 'synced' : 'syncing');
        })
        .catch(() => setSyncStatus('offline'))
        .finally(finishCartSync);
    }, 650);

    return () => clearTimeout(timer);
  }, [auth.user?.customerId, finishCartSync, hydrated, items, syncAttempt]);

  useEffect(() => {
    if (!auth.user?.customerId) return;
    const interval = setInterval(requestCartSync, 10_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestCartSync();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [auth.user?.customerId, requestCartSync]);

  useEffect(() => {
    if (!auth.user?.customerId) return;

    let disposed = false;
    let connection: import('@microsoft/signalr').HubConnection | null = null;

    void import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
      if (disposed) return;
      connection = new HubConnectionBuilder()
        .withUrl(`${getApiOrigin()}/hubs/store-notifications`, {
          accessTokenFactory: async () => (await getToken()) ?? '',
        })
        .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
        .configureLogging(LogLevel.Warning)
        .build();

      connection.on('cartUpdated', () => {
        if (cartEventTimerRef.current) clearTimeout(cartEventTimerRef.current);
        cartEventTimerRef.current = setTimeout(() => {
          if (!disposed) requestCartSync();
        }, 450);
      });
      connection.onreconnected(() => requestCartSync());
      void connection.start().catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      disposed = true;
      if (cartEventTimerRef.current) {
        clearTimeout(cartEventTimerRef.current);
        cartEventTimerRef.current = null;
      }
      void connection?.stop();
    };
  }, [auth.user?.customerId, requestCartSync]);

  useEffect(() => {
    const customerId = auth.user?.customerId ?? null;
    if (!customerId || ownerRef.current !== customerId) return;
    if (syncBusyRef.current) {
      syncQueuedRef.current = true;
      return;
    }
    if (cartFingerprint(itemsRef.current) !== syncedFingerprintRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    let active = true;
    let retryDirtyCart = false;
    const startingFingerprint = cartFingerprint(itemsRef.current);
    syncQueuedRef.current = false;
    syncBusyRef.current = true;
    void commerceApi.cart()
      .then((remote) => {
        if (!active) return;
        if (cartFingerprint(itemsRef.current) !== startingFingerprint) {
          retryDirtyCart = true;
          setSyncStatus('syncing');
          return;
        }
        if (remote.revision > revisionRef.current) {
          const remoteItems = fromSyncedCart(remote);
          revisionRef.current = remote.revision;
          syncedFingerprintRef.current = cartFingerprint(remoteItems);
          setItems(remoteItems);
          setLastSyncedAt(remote.updatedAt);
        }
        setSyncStatus('synced');
      })
      .catch(() => {
        if (active) setSyncStatus('offline');
      })
      .finally(() => {
        if (active && retryDirtyCart) syncQueuedRef.current = true;
        finishCartSync();
      });

    return () => { active = false; };
  }, [auth.user?.customerId, finishCartSync, syncAttempt]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    hydrated,
    syncStatus,
    lastSyncedAt,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addProduct: (product, requestedQuantity) => {
      if (product.price == null || product.stock <= 0) return;
      const unitId = product.unitId ?? null;
      const lineKey = `${product.id}:${unitId ?? 'base'}`;
      const quantityStep = cartQuantityStep(product);
      setItems((current) => {
        const found = current.find((item) => item.lineKey === lineKey);
        if (found) {
          const nextQuantity = requestedQuantity == null ? found.quantity + quantityStep : requestedQuantity;
          return current.map((item) => item.lineKey === lineKey
            ? {
              ...item,
              name: product.name,
              image: product.primaryImageUrl,
              price: product.price!,
              stock: product.stock,
              unitName: product.unitName,
              quantityStep,
              quickOrderQuantities: product.quickOrderQuantities ?? [],
              quantity: normalizeCartQuantity({ ...item, stock: product.stock, quantityStep }, nextQuantity),
            }
            : item);
        }
        const quantity = normalizeCartQuantity(
          { stock: product.stock, quantityStep },
          requestedQuantity == null ? quantityStep : requestedQuantity,
        );
        if (quantity <= 0) return current;
        return [...current, {
          lineKey,
          id: product.id,
          name: product.name,
          image: product.primaryImageUrl,
          price: product.price!,
          stock: product.stock,
          unitId,
          unitName: product.unitName,
          quantityStep,
          quickOrderQuantities: product.quickOrderQuantities ?? [],
          quantity,
        }];
      });
    },
    updateQuantity: (lineKey, quantity) => setItems((current) =>
      current.map((item) => item.lineKey === lineKey
        ? { ...item, quantity: normalizeCartQuantity(item, quantity) }
        : item).filter((item) => item.quantity > 0)),
    removeItem: (lineKey) => setItems((current) => current.filter((item) => item.lineKey !== lineKey)),
    clear: () => setItems([]),
  }), [hydrated, items, lastSyncedAt, syncStatus]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function toSyncedItems(items: CartItem[]): SyncedCartItem[] {
  return [...items]
    .sort((left, right) => left.lineKey.localeCompare(right.lineKey))
    .map((item) => ({
      productId: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      stock: item.stock,
      unitId: item.unitId,
      unitName: item.unitName,
      quantityStep: item.quantityStep,
      quickOrderQuantities: item.quickOrderQuantities,
      quantity: item.quantity,
    }));
}

function fromSyncedCart(cart: SyncedCart): CartItem[] {
  return cart.items.map((item) => {
    const quantityStep = cartQuantityStep(item);
    const normalized: CartItem = {
      lineKey: `${item.productId}:${item.unitId ?? 'base'}`,
      id: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      stock: item.stock,
      unitId: item.unitId ?? null,
      unitName: item.unitName ?? null,
      quantityStep,
      quickOrderQuantities: Array.isArray(item.quickOrderQuantities) ? item.quickOrderQuantities : [],
      quantity: item.quantity,
    };
    return { ...normalized, quantity: normalizeCartQuantity(normalized, normalized.quantity) };
  }).filter((item) => item.quantity > 0);
}

function cartFingerprint(items: CartItem[]) {
  return JSON.stringify(toSyncedItems(items));
}

function mergeCartItems(serverItems: CartItem[], localItems: CartItem[]) {
  const merged = new Map(serverItems.map((item) => [item.lineKey, item]));
  localItems.forEach((local) => {
    const server = merged.get(local.lineKey);
    if (!server) {
      merged.set(local.lineKey, local);
      return;
    }
    const live = { ...server, ...local, stock: Math.max(server.stock, local.stock) };
    merged.set(local.lineKey, {
      ...live,
      quantity: normalizeCartQuantity(live, Math.max(server.quantity, local.quantity)),
    });
  });
  return [...merged.values()].filter((item) => item.quantity > 0);
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider.');
  return context;
}
