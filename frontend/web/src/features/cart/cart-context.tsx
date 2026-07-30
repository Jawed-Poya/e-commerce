import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
  clear: () => void;
  toggleWishlist: (id: number) => void;
  clearWishlist: () => void;
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

type QuantityLimitedProduct = Pick<CartProduct, "stock" | "minimumValue" | "maximumValue">;

export function minimumCartQuantity(_product: QuantityLimitedProduct) {
  return 1;
}

export function maximumCartQuantity(product: QuantityLimitedProduct) {
  return Math.max(0, product.stock);
}

export function cartQuantityStep(product: QuantityLimitedProduct) {
  const minimum = minimumCartQuantity(product);
  return minimum < 1 ? minimum : 1;
}

export function normalizeCartQuantity(product: QuantityLimitedProduct, quantity: number) {
  const minimum = minimumCartQuantity(product);
  const maximum = maximumCartQuantity(product);
  if (maximum < minimum) return 0;
  if (!Number.isFinite(quantity)) return minimum;

  const bounded = Math.min(maximum, Math.max(minimum, quantity));
  return Math.round((bounded + Number.EPSILON) * 1000) / 1000;
}

function normalizeStoredItem(item: CartItem | (CartProduct & { quantity: number })) {
  const unitId = item.unitId ?? null;
  const normalized: CartItem = {
    ...item,
    unitId,
    unitName: item.unitName ?? null,
    conversionFactor: item.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1,
    lineKey: "lineKey" in item && item.lineKey ? item.lineKey : cartLineKey(item.id, unitId),
    quantity: normalizeCartQuantity(item, item.quantity),
  };
  return normalized;
}

function sameNumberArray(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    readStorage<CartItem[]>("store-cart", [])
      .map(normalizeStoredItem)
      .filter((item) => item.quantity > 0),
  );
  const [wishlist, setWishlist] = useState<number[]>(() =>
    readStorage("store-wishlist", []),
  );

  useEffect(
    () => localStorage.setItem("store-cart", JSON.stringify(items)),
    [items],
  );
  useEffect(
    () => localStorage.setItem("store-wishlist", JSON.stringify(wishlist)),
    [wishlist],
  );

  const value = useMemo<CartValue>(
    () => ({
      items,
      wishlist,
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
      updateQuantity: (lineKey, quantity) =>
        setItems((current) =>
          current.map((item) =>
            item.lineKey === lineKey
              ? { ...item, quantity: normalizeCartQuantity(item, quantity) }
              : item,
          ).filter((item) => item.quantity > 0),
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
    [items, wishlist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
