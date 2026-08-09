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
    [items, wishlist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
