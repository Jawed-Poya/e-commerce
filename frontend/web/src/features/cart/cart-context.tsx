import {
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/auth-context";
import { ApiError, apiUrl, customerTokenKey } from "../../shared/api/api-client";
import { getSyncedCart, updateSyncedCart, type SyncedCart, type SyncedCartItem } from "./cart-sync-api";

export interface CartProduct {
  id: number;
  slug?: string | null;
  name: string;
  image?: string | null;
  price: number;
  stock: number;
  unitId?: number | null;
  unitName?: string | null;
  conversionFactor?: number;
  quantityStep?: number;
  quickOrderQuantities?: number[];
  minimumValue?: number | null;
  maximumValue?: number | null;
}

export interface CartItem extends CartProduct {
  lineKey: string;
  quantity: number;
}

interface CartValue {
  items: CartItem[];
  wishlist: number[];
  count: number;
  addItem: (product: CartProduct) => void;
  updateQuantity: (lineKey: string, quantity: number, product?: Partial<CartProduct>) => void;
  removeItem: (lineKey: string) => void;
  clear: () => void;
  toggleWishlist: (id: number) => void;
  clearWishlist: () => void;
  syncStatus: "local" | "syncing" | "synced" | "offline";
}

const CartContext = createContext<CartValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

export function cartLineKey(productId: number, unitId?: number | null) {
  return `${productId}:${unitId ?? "base"}`;
}

type QuantityLimitedProduct = Pick<CartProduct, "stock" | "quantityStep" | "minimumValue" | "maximumValue">;

function roundCartQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function cartQuantityStep(product: QuantityLimitedProduct) {
  const configured = Number(product.quantityStep ?? 1);
  return Number.isFinite(configured) && configured > 0
    ? roundCartQuantity(configured)
    : 1;
}

export function minimumCartQuantity(product: QuantityLimitedProduct) {
  return cartQuantityStep(product);
}

export function maximumCartQuantity(product: QuantityLimitedProduct) {
  const stock = Math.max(0, Number(product.stock) || 0);
  const step = cartQuantityStep(product);
  if (stock < step) return 0;
  return roundCartQuantity(Math.floor((stock + Number.EPSILON) / step) * step);
}

export function cartQuickQuantities(product: CartProduct) {
  const step = cartQuantityStep(product);
  const maximum = maximumCartQuantity(product);
  return [...new Set((product.quickOrderQuantities ?? [])
    .map(Number)
    .filter((quantity) =>
      Number.isFinite(quantity) &&
      quantity > 0 &&
      quantity <= maximum + Number.EPSILON &&
      Math.abs(quantity / step - Math.round(quantity / step)) < 1e-9,
    )
    .map(roundCartQuantity))]
    .sort((a, b) => a - b);
}

export function normalizeCartQuantity(product: QuantityLimitedProduct, quantity: number) {
  const minimum = minimumCartQuantity(product);
  const maximum = maximumCartQuantity(product);
  const step = cartQuantityStep(product);
  if (maximum < minimum) return 0;
  if (!Number.isFinite(quantity)) return minimum;
  if (quantity <= 0) return 0;

  const bounded = Math.min(maximum, Math.max(minimum, quantity));
  const stepped = Math.floor((bounded + Number.EPSILON) / step) * step;
  return roundCartQuantity(Math.max(minimum, stepped));
}

function normalizeStoredItem(item: CartItem | (CartProduct & { quantity: number })) {
  const unitId = item.unitId ?? null;
  const normalized: CartItem = {
    ...item,
    unitId,
    unitName: item.unitName ?? null,
    conversionFactor: item.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1,
    quantityStep: cartQuantityStep(item),
    quickOrderQuantities: Array.isArray(item.quickOrderQuantities) ? item.quickOrderQuantities : [],
    lineKey: "lineKey" in item && item.lineKey ? item.lineKey : cartLineKey(item.id, unitId),
    quantity: normalizeCartQuantity(item, item.quantity),
  };
  return normalized;
}

function sameNumberArray(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<number[]>(() =>
    readStorage("store-wishlist", []),
  );
  const [syncStatus, setSyncStatus] = useState<CartValue["syncStatus"]>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const itemsRef = useRef(items);
  const ownerRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const syncedFingerprintRef = useRef("");
  const syncBusyRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const cartEventTimerRef = useRef<number | null>(null);

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
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => localStorage.setItem("store-wishlist", JSON.stringify(wishlist)),
    [wishlist],
  );

  useEffect(() => {
    if (auth.loading) return;
    const customerId = auth.user?.customerId ?? null;
    if (!customerId) {
      const wasAccountCart = ownerRef.current !== null;
      ownerRef.current = null;
      revisionRef.current = 0;
      syncedFingerprintRef.current = "";
      syncQueuedRef.current = false;
      if (wasAccountCart) {
        itemsRef.current = [];
        setItems([]);
      }
      setSyncStatus("local");
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
    setSyncStatus("syncing");
    void getSyncedCart()
      .then(async (remote) => {
        const serverItems = fromSyncedCart(remote);
        const localItems = ownerRef.current === null ? itemsRef.current : [];
        const merged = mergeCartItems(serverItems, localItems);
        const resolved = cartFingerprint(merged) === cartFingerprint(serverItems)
          ? remote
          : await updateSyncedCart({
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
        setSyncStatus("synced");
      })
      .catch(() => {
        if (!active) return;
        setSyncStatus("offline");
      })
      .finally(finishCartSync);

    return () => { active = false; };
  }, [auth.loading, auth.user?.customerId, finishCartSync, syncAttempt]);

  useEffect(() => {
    const customerId = auth.user?.customerId ?? null;
    if (!customerId || ownerRef.current !== customerId) return;
    if (syncBusyRef.current) {
      syncQueuedRef.current = true;
      return;
    }
    const targetFingerprint = cartFingerprint(items);
    if (targetFingerprint === syncedFingerprintRef.current) return;

    const timer = window.setTimeout(() => {
      if (syncBusyRef.current) {
        syncQueuedRef.current = true;
        return;
      }
      const target = itemsRef.current;
      const fingerprint = cartFingerprint(target);
      syncBusyRef.current = true;
      setSyncStatus("syncing");

      const push = async () => {
        try {
          return await updateSyncedCart({
            baseRevision: revisionRef.current,
            merge: false,
            items: toSyncedItems(target),
          });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
          const latest = await getSyncedCart();
          revisionRef.current = latest.revision;
          return updateSyncedCart({
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
          setSyncStatus(cartFingerprint(itemsRef.current) === fingerprint ? "synced" : "syncing");
        })
        .catch(() => setSyncStatus("offline"))
        .finally(finishCartSync);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [auth.user?.customerId, finishCartSync, items, syncAttempt]);

  useEffect(() => {
    if (!auth.user?.customerId) return;
    const interval = window.setInterval(requestCartSync, 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") requestCartSync(); };
    window.addEventListener("focus", requestCartSync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", requestCartSync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auth.user?.customerId, requestCartSync]);

  useEffect(() => {
    if (!auth.user?.customerId) return;

    let disposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl(apiUrl("/hubs/store-notifications"), {
        accessTokenFactory: () => localStorage.getItem(customerTokenKey) ?? "",
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("cartUpdated", () => {
      if (cartEventTimerRef.current !== null) {
        window.clearTimeout(cartEventTimerRef.current);
      }
      cartEventTimerRef.current = window.setTimeout(() => {
        if (!disposed) requestCartSync();
      }, 450);
    });
    connection.onreconnected(() => requestCartSync());
    void connection.start().catch(() => undefined);

    return () => {
      disposed = true;
      if (cartEventTimerRef.current !== null) {
        window.clearTimeout(cartEventTimerRef.current);
        cartEventTimerRef.current = null;
      }
      void connection.stop();
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
    void getSyncedCart()
      .then((remote) => {
        if (!active) return;
        if (cartFingerprint(itemsRef.current) !== startingFingerprint) {
          retryDirtyCart = true;
          setSyncStatus("syncing");
          return;
        }
        if (remote.revision > revisionRef.current) {
          const remoteItems = fromSyncedCart(remote);
          revisionRef.current = remote.revision;
          syncedFingerprintRef.current = cartFingerprint(remoteItems);
          setItems(remoteItems);
        }
        setSyncStatus("synced");
      })
      .catch(() => { if (active) setSyncStatus("offline"); })
      .finally(() => {
        if (active && retryDirtyCart) syncQueuedRef.current = true;
        finishCartSync();
      });
    return () => { active = false; };
  }, [auth.user?.customerId, finishCartSync, syncAttempt]);

  const value = useMemo<CartValue>(
    () => ({
      items,
      wishlist,
      syncStatus,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (product) =>
        setItems((current) => {
          const minimum = minimumCartQuantity(product);
          const maximum = maximumCartQuantity(product);
          if (maximum < minimum) return current;

          const lineKey = cartLineKey(product.id, product.unitId);
          const found = current.find((item) => item.lineKey === lineKey);
          if (found) {
            const quantity = normalizeCartQuantity(
              product,
              found.quantity + cartQuantityStep(product),
            );
            return current.map((item) =>
              item.lineKey === lineKey
                ? { ...item, ...product, lineKey, quantity }
                : item,
            );
          }

          return [...current, { ...product, lineKey, quantity: minimum }];
        }),
      updateQuantity: (lineKey, quantity, product) =>
        setItems((current) =>
          current.map((item) => {
            if (item.lineKey !== lineKey) return item;
            const liveItem = product ? { ...item, ...product, lineKey } : item;
            return {
              ...liveItem,
              quantity: normalizeCartQuantity(liveItem, quantity),
            };
          }).filter((item) => item.quantity > 0),
        ),
      removeItem: (lineKey) =>
        setItems((current) => current.filter((item) => item.lineKey !== lineKey)),
      clear: () => setItems([]),
      toggleWishlist: (id) =>
        setWishlist((current) => {
          const next = current.includes(id)
            ? current.filter((value) => value !== id)
            : [...current, id];
          return sameNumberArray(current, next) ? current : next;
        }),
      clearWishlist: () => setWishlist([]),
    }),
    [items, syncStatus, wishlist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function toSyncedItems(items: CartItem[]): SyncedCartItem[] {
  return [...items]
    .sort((left, right) => left.lineKey.localeCompare(right.lineKey))
    .map((item) => ({
      productId: item.id,
      name: item.name,
      image: item.image ?? null,
      price: item.price,
      stock: item.stock,
      unitId: item.unitId ?? null,
      unitName: item.unitName ?? null,
      quantityStep: item.quantityStep ?? 1,
      quickOrderQuantities: item.quickOrderQuantities ?? [],
      quantity: item.quantity,
    }));
}

function fromSyncedCart(cart: SyncedCart): CartItem[] {
  return cart.items.map((item) => normalizeStoredItem({
    id: item.productId,
    name: item.name,
    image: item.image,
    price: item.price,
    stock: item.stock,
    unitId: item.unitId,
    unitName: item.unitName,
    conversionFactor: 1,
    quantityStep: item.quantityStep,
    quickOrderQuantities: item.quickOrderQuantities,
    quantity: item.quantity,
  })).filter((item) => item.quantity > 0);
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
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
